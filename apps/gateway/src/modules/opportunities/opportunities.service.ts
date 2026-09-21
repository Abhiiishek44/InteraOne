import { Types } from "mongoose";
import {
  Contact,
  Membership,
  Opportunity,
  OpportunityStage,
  SalesPipeline,
  DEFAULT_PIPELINE_STAGES,
  IPipelineStage,
} from "@shared/models";

interface CreateOpportunityInput {
  contactId: string;
  title: string;
  company?: string;
  value?: number;
  currency?: "USD" | "INR" | "EUR" | "GBP";
  stage?: OpportunityStage;
  ownerId?: string | null;
  expectedCloseAt?: string | null;
  nextAction?: string;
}

type UpdateOpportunityInput = Partial<
  Omit<CreateOpportunityInput, "contactId" | "stage">
>;

export class OpportunitiesService {
  async getPipeline(organizationId: string) {
    const pipeline = await SalesPipeline.findOne({ organizationId }).lean();
    const stages = pipeline?.stages?.length
      ? [...pipeline.stages].sort((a, b) => a.order - b.order)
      : DEFAULT_PIPELINE_STAGES.map((stage) => ({ ...stage }));

    return {
      name: pipeline?.name || "Sales pipeline",
      stages,
      isDefault: !pipeline,
    };
  }

  async updatePipeline(
    organizationId: string,
    input: { name: string; stages: IPipelineStage[] },
  ) {
    const current = await this.getPipeline(organizationId);
    const nextStageIds = new Set(input.stages.map((stage) => stage.id));
    const removedStageIds = current.stages
      .map((stage) => stage.id)
      .filter((stageId) => !nextStageIds.has(stageId));
    const changedTypeStageIds = current.stages
      .filter((stage) => {
        const next = input.stages.find((item) => item.id === stage.id);
        return next && next.type !== stage.type;
      })
      .map((stage) => stage.id);
    const protectedStageIds = [
      ...new Set([...removedStageIds, ...changedTypeStageIds]),
    ];

    if (protectedStageIds.length > 0) {
      const usedStage = await Opportunity.findOne({
        organizationId,
        stage: { $in: protectedStageIds },
      })
        .select("stage")
        .lean();
      if (usedStage) {
        const removed = current.stages.find(
          (stage) => stage.id === usedStage.stage,
        );
        const action = removedStageIds.includes(usedStage.stage)
          ? "deleting it"
          : "changing its stage type";
        throw new Error(
          `Move all opportunities out of ${removed?.label || "this stage"} before ${action}`,
        );
      }
    }

    const stages = input.stages.map((stage, order) => ({
      ...stage,
      label: stage.label.trim(),
      order,
    }));
    const pipeline = await SalesPipeline.findOneAndUpdate(
      { organizationId },
      {
        $set: {
          name: input.name.trim(),
          stages,
        },
      },
      { upsert: true, new: true, runValidators: true },
    ).lean();

    return {
      name: pipeline!.name,
      stages: [...pipeline!.stages].sort((a, b) => a.order - b.order),
      isDefault: false,
    };
  }

  private async getStage(
    organizationId: string,
    stageId?: string,
  ): Promise<IPipelineStage> {
    const pipeline = await this.getPipeline(organizationId);
    const fallback = pipeline.stages.find((stage) => stage.type === "open");
    const stage = stageId
      ? pipeline.stages.find((item) => item.id === stageId)
      : fallback;
    if (!stage) throw new Error("Pipeline stage does not exist");
    return stage;
  }

  async list(organizationId: string) {
    const opportunities = await Opportunity.find({ organizationId })
      .populate("contactId", "name email phone company lifecycleStage")
      .populate("ownerId", "name email")
      .sort({ stage: 1, position: 1, updatedAt: -1 })
      .lean();

    return opportunities.map((opportunity: any) => ({
      id: opportunity._id.toString(),
      title: opportunity.title,
      company: opportunity.company,
      value: opportunity.value,
      currency: opportunity.currency,
      stage: opportunity.stage,
      color: opportunity.color || "slate",
      position: opportunity.position || 0,
      priority: opportunity.priority || 1,
      expectedCloseAt: opportunity.expectedCloseAt?.toISOString() || null,
      nextAction: opportunity.nextAction || "",
      activities: (opportunity.activities || []).map((activity: any) => ({
        id: activity.id,
        type: activity.type || "note",
        content: activity.content,
        category: activity.category || "todo",
        dueAt: activity.dueAt ? new Date(activity.dueAt).toISOString() : null,
        completedAt: activity.completedAt
          ? new Date(activity.completedAt).toISOString()
          : null,
        createdAt: new Date(activity.createdAt).toISOString(),
      })),
      contact: opportunity.contactId
        ? {
            id: opportunity.contactId._id.toString(),
            name: opportunity.contactId.name,
            email: opportunity.contactId.email,
            phone: opportunity.contactId.phone,
            company: opportunity.contactId.company,
          }
        : null,
      owner: opportunity.ownerId
        ? {
            id: opportunity.ownerId._id.toString(),
            name: opportunity.ownerId.name,
            email: opportunity.ownerId.email,
          }
        : null,
      createdAt: opportunity.createdAt.toISOString(),
      updatedAt: opportunity.updatedAt.toISOString(),
    }));
  }

  async create(organizationId: string, input: CreateOpportunityInput) {
    const orgId = new Types.ObjectId(organizationId);
    const pipelineStage = await this.getStage(organizationId, input.stage);
    const position = await Opportunity.countDocuments({
      organizationId: orgId,
      stage: pipelineStage.id,
    });
    const contact = await Contact.findOne({
      _id: new Types.ObjectId(input.contactId),
      organizationId: orgId,
    });
    if (!contact) throw new Error("Contact not found");

    if (input.ownerId) {
      const membership = await Membership.exists({
        organizationId: orgId,
        userId: new Types.ObjectId(input.ownerId),
        inviteStatus: "accepted",
      });
      if (!membership)
        throw new Error(
          "Opportunity owner must be an active organization member",
        );
    }

    const opportunity = await Opportunity.create({
      organizationId: orgId,
      contactId: contact._id,
      title: input.title,
      company: input.company || contact.company,
      value: input.value || 0,
      currency: input.currency || "USD",
      stage: pipelineStage.id,
      position,
      ownerId: input.ownerId
        ? new Types.ObjectId(input.ownerId)
        : contact.ownerId || null,
      expectedCloseAt: input.expectedCloseAt
        ? new Date(input.expectedCloseAt)
        : null,
      nextAction: input.nextAction || "",
    });

    await this.syncContactLifecycle(
      organizationId,
      contact._id.toString(),
      pipelineStage,
    );
    return opportunity;
  }

  async update(
    organizationId: string,
    opportunityId: string,
    input: UpdateOpportunityInput,
  ) {
    const orgId = new Types.ObjectId(organizationId);
    if (input.ownerId) {
      const membership = await Membership.exists({
        organizationId: orgId,
        userId: new Types.ObjectId(input.ownerId),
        inviteStatus: "accepted",
      });
      if (!membership) {
        throw new Error(
          "Opportunity owner must be an active organization member",
        );
      }
    }

    const updates: Record<string, unknown> = {};
    if (input.title !== undefined) updates.title = input.title.trim();
    if (input.company !== undefined) updates.company = input.company.trim();
    if (input.value !== undefined) updates.value = input.value;
    if (input.currency !== undefined) updates.currency = input.currency;
    if (input.ownerId !== undefined) {
      updates.ownerId = input.ownerId
        ? new Types.ObjectId(input.ownerId)
        : null;
    }
    if (input.expectedCloseAt !== undefined) {
      updates.expectedCloseAt = input.expectedCloseAt
        ? new Date(input.expectedCloseAt)
        : null;
    }
    if (input.nextAction !== undefined) {
      updates.nextAction = input.nextAction.trim();
    }

    const opportunity = await Opportunity.findOneAndUpdate(
      { _id: opportunityId, organizationId: orgId },
      {
        $set: updates,
        $push: {
          activities: {
            $each: [
              {
                id: `activity-${Date.now()}`,
                type: "status",
                content: "Opportunity details updated",
                createdAt: new Date(),
              },
            ],
            $position: 0,
          },
        },
      },
      { new: true, runValidators: true },
    );
    if (!opportunity) throw new Error("Opportunity not found");
    return opportunity;
  }

  async remove(organizationId: string, opportunityId: string) {
    const opportunity = await Opportunity.findOneAndDelete({
      _id: opportunityId,
      organizationId,
    });
    if (!opportunity) throw new Error("Opportunity not found");

    await this.syncContactFromOpportunities(
      organizationId,
      opportunity.contactId.toString(),
    );
    await this.syncContactNextFollowUp(
      organizationId,
      opportunity.contactId.toString(),
    );
  }

  async updateStage(
    organizationId: string,
    opportunityId: string,
    stage: OpportunityStage,
  ) {
    const pipelineStage = await this.getStage(organizationId, stage);
    const existing = await Opportunity.findOne({
      _id: opportunityId,
      organizationId,
    });
    if (!existing) throw new Error("Opportunity not found");
    const previousStage = existing.stage;
    const opportunity = await Opportunity.findOneAndUpdate(
      { _id: opportunityId, organizationId },
      {
        $set: { stage: pipelineStage.id },
        $push: {
          activities: {
            $each: [
              {
                id: `activity-${Date.now()}`,
                type: "status",
                content: `Stage changed: ${previousStage} → ${pipelineStage.id}`,
                createdAt: new Date(),
              },
            ],
            $position: 0,
          },
        },
      },
      { new: true, runValidators: true },
    );
    if (!opportunity) throw new Error("Opportunity not found");

    await this.syncContactLifecycle(
      organizationId,
      opportunity.contactId.toString(),
      pipelineStage,
      opportunity._id.toString(),
    );
    return opportunity;
  }

  async updateColor(
    organizationId: string,
    opportunityId: string,
    color: string,
  ) {
    const opportunity = await Opportunity.findOneAndUpdate(
      { _id: opportunityId, organizationId },
      { $set: { color } },
      { new: true, runValidators: true },
    );
    if (!opportunity) throw new Error("Opportunity not found");
    return opportunity;
  }

  async updateNextAction(
    organizationId: string,
    opportunityId: string,
    nextAction: string,
  ) {
    const opportunity = await Opportunity.findOneAndUpdate(
      { _id: opportunityId, organizationId },
      { $set: { nextAction: nextAction.trim() } },
      { new: true, runValidators: true },
    );
    if (!opportunity) throw new Error("Opportunity not found");
    return opportunity;
  }

  async addActivity(
    organizationId: string,
    opportunityId: string,
    content: string,
    dueAt?: string | null,
    category?: "todo" | "email" | "call" | "meeting" | "document",
  ) {
    const activity = {
      id: `activity-${Date.now()}`,
      type: dueAt ? ("planned" as const) : ("note" as const),
      content: content.trim(),
      category: category || "todo",
      dueAt: dueAt ? new Date(dueAt) : null,
      completedAt: null,
      createdAt: new Date(),
    };
    const opportunity = await Opportunity.findOneAndUpdate(
      { _id: opportunityId, organizationId },
      { $push: { activities: { $each: [activity], $position: 0 } } },
      { new: true, runValidators: true },
    );
    if (!opportunity) throw new Error("Opportunity not found");
    if (activity.dueAt) {
      await this.syncContactNextFollowUp(
        organizationId,
        opportunity.contactId.toString(),
      );
    }
    return activity;
  }

  async updatePriority(
    organizationId: string,
    opportunityId: string,
    priority: 1 | 2 | 3,
  ) {
    const opportunity = await Opportunity.findOneAndUpdate(
      { _id: opportunityId, organizationId },
      { $set: { priority } },
      { new: true, runValidators: true },
    );
    if (!opportunity) throw new Error("Opportunity not found");
    return opportunity;
  }

  async completeActivity(
    organizationId: string,
    opportunityId: string,
    activityId: string,
  ) {
    const opportunity = await Opportunity.findOneAndUpdate(
      { _id: opportunityId, organizationId, "activities.id": activityId },
      { $set: { "activities.$.completedAt": new Date() } },
      { new: true },
    );
    if (!opportunity) throw new Error("Activity not found");
    await this.syncContactNextFollowUp(
      organizationId,
      opportunity.contactId.toString(),
    );
    return opportunity;
  }

  async updateNote(
    organizationId: string,
    opportunityId: string,
    activityId: string,
    content: string,
  ) {
    const opportunity = await Opportunity.findOne({
      _id: opportunityId,
      organizationId,
    });
    const activity = opportunity?.activities.find(
      (item) => item.id === activityId && item.type === "note",
    );
    if (!opportunity || !activity)
      throw new Error("Opportunity note not found");
    activity.content = content.trim();
    await opportunity.save();
    return activity;
  }

  async deleteNote(
    organizationId: string,
    opportunityId: string,
    activityId: string,
  ) {
    const result = await Opportunity.updateOne(
      {
        _id: opportunityId,
        organizationId,
        activities: { $elemMatch: { id: activityId, type: "note" } },
      },
      { $pull: { activities: { id: activityId, type: "note" } } },
    );
    if (result.modifiedCount === 0) {
      throw new Error("Opportunity note not found");
    }
  }

  async move(
    organizationId: string,
    opportunityId: string,
    stage: OpportunityStage,
    position: number,
  ) {
    const pipelineStage = await this.getStage(organizationId, stage);
    const opportunity = await Opportunity.findOne({
      _id: opportunityId,
      organizationId,
    });
    if (!opportunity) throw new Error("Opportunity not found");

    const targetItems = await Opportunity.find({
      organizationId,
      stage: pipelineStage.id,
      _id: { $ne: opportunity._id },
    }).sort({ position: 1, updatedAt: -1 });
    const targetPosition = Math.min(Math.max(position, 0), targetItems.length);
    targetItems.splice(targetPosition, 0, opportunity);

    const previousStage = opportunity.stage;
    opportunity.stage = pipelineStage.id;
    await Opportunity.bulkWrite(
      targetItems.map((item, index) => ({
        updateOne: {
          filter: { _id: item._id, organizationId },
          update: { $set: { stage: pipelineStage.id, position: index } },
        },
      })),
    );

    if (previousStage !== pipelineStage.id) {
      await Opportunity.updateOne(
        { _id: opportunity._id, organizationId },
        {
          $push: {
            activities: {
              $each: [
                {
                  id: `activity-${Date.now()}`,
                  type: "status",
                  content: `Stage changed: ${previousStage} → ${pipelineStage.id}`,
                  createdAt: new Date(),
                },
              ],
              $position: 0,
            },
          },
        },
      );
    }

    await this.syncContactLifecycle(
      organizationId,
      opportunity.contactId.toString(),
      pipelineStage,
      opportunity._id.toString(),
    );
    return opportunity;
  }

  private async syncContactLifecycle(
    organizationId: string,
    contactId: string,
    stage: IPipelineStage,
    currentOpportunityId?: string,
  ) {
    if (stage.type === "won") {
      await Contact.updateOne(
        { _id: contactId, organizationId },
        { $set: { lifecycleStage: "customer", leadStatus: "converted" } },
      );
      return;
    }

    if (stage.type === "lost") {
      const pipeline = await this.getPipeline(organizationId);
      const closedStageIds = pipeline.stages
        .filter((item) => item.type !== "open")
        .map((item) => item.id);
      const otherActive = await Opportunity.exists({
        organizationId,
        contactId,
        stage: { $nin: closedStageIds },
        ...(currentOpportunityId ? { _id: { $ne: currentOpportunityId } } : {}),
      });
      if (!otherActive) {
        await Contact.updateOne(
          {
            _id: contactId,
            organizationId,
            lifecycleStage: { $ne: "customer" },
          },
          {
            $set: {
              lifecycleStage: "lost",
              leadStatus: "unqualified",
            },
          },
        );
      }
      return;
    }

    await Contact.updateOne(
      { _id: contactId, organizationId, lifecycleStage: { $ne: "customer" } },
      { $set: { lifecycleStage: "opportunity", leadStatus: "follow_up" } },
    );
  }

  private async syncContactNextFollowUp(
    organizationId: string,
    contactId: string,
  ) {
    const opportunities = await Opportunity.find({
      organizationId,
      contactId,
      activities: {
        $elemMatch: {
          type: "planned",
          completedAt: null,
          dueAt: { $ne: null },
        },
      },
    })
      .select("activities")
      .lean();
    const pendingDates = opportunities.flatMap((item) =>
      (item.activities || [])
        .filter(
          (activity) =>
            activity.type === "planned" &&
            !activity.completedAt &&
            activity.dueAt,
        )
        .map((activity) => new Date(activity.dueAt!)),
    );
    const contact = await Contact.findOne({
      _id: contactId,
      organizationId,
    })
      .select("manualNextFollowUpAt nextFollowUpAt")
      .lean();
    const manualNextFollowUpAt =
      contact?.manualNextFollowUpAt === undefined
        ? contact?.nextFollowUpAt
        : contact.manualNextFollowUpAt;
    if (manualNextFollowUpAt) {
      pendingDates.push(new Date(manualNextFollowUpAt));
    }
    const nextFollowUpAt = pendingDates.length
      ? new Date(Math.min(...pendingDates.map((date) => date.getTime())))
      : null;
    await Contact.updateOne(
      { _id: contactId, organizationId },
      { $set: { nextFollowUpAt } },
    );
  }

  private async syncContactFromOpportunities(
    organizationId: string,
    contactId: string,
  ) {
    const pipeline = await this.getPipeline(organizationId);
    const opportunities = await Opportunity.find({
      organizationId,
      contactId,
    })
      .select("stage")
      .lean();
    const stageTypes = opportunities.map(
      (item) =>
        pipeline.stages.find((stage) => stage.id === item.stage)?.type ||
        "open",
    );

    if (stageTypes.includes("won")) {
      await Contact.updateOne(
        { _id: contactId, organizationId },
        { $set: { lifecycleStage: "customer", leadStatus: "converted" } },
      );
      return;
    }
    if (stageTypes.includes("open")) {
      await Contact.updateOne(
        { _id: contactId, organizationId, lifecycleStage: { $ne: "customer" } },
        { $set: { lifecycleStage: "opportunity", leadStatus: "follow_up" } },
      );
      return;
    }
    if (stageTypes.includes("lost")) {
      await Contact.updateOne(
        { _id: contactId, organizationId, lifecycleStage: { $ne: "customer" } },
        { $set: { lifecycleStage: "lost", leadStatus: "unqualified" } },
      );
      return;
    }
    await Contact.updateOne(
      { _id: contactId, organizationId, lifecycleStage: "opportunity" },
      { $set: { lifecycleStage: "qualified", leadStatus: "follow_up" } },
    );
  }
}
