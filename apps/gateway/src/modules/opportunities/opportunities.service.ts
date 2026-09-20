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
      .sort({ updatedAt: -1 })
      .lean();

    return opportunities.map((opportunity: any) => ({
      id: opportunity._id.toString(),
      title: opportunity.title,
      company: opportunity.company,
      value: opportunity.value,
      currency: opportunity.currency,
      stage: opportunity.stage,
      color: opportunity.color || "slate",
      expectedCloseAt: opportunity.expectedCloseAt?.toISOString() || null,
      nextAction: opportunity.nextAction || "",
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

  async updateStage(
    organizationId: string,
    opportunityId: string,
    stage: OpportunityStage,
  ) {
    const pipelineStage = await this.getStage(organizationId, stage);
    const opportunity = await Opportunity.findOneAndUpdate(
      { _id: opportunityId, organizationId },
      { $set: { stage: pipelineStage.id } },
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
          { $set: { lifecycleStage: "lost" } },
        );
      }
      return;
    }

    await Contact.updateOne(
      { _id: contactId, organizationId, lifecycleStage: { $ne: "customer" } },
      { $set: { lifecycleStage: "opportunity" } },
    );
  }
}
