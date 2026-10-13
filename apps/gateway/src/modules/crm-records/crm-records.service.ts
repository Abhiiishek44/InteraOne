import { Types } from "mongoose";
import {
  Contact,
  Membership,
  CrmRecord,
  CrmRecordStage,
  SalesPipeline,
  DEFAULT_PIPELINE_STAGES,
  IPipelineStage,
  Account,
  LeadSourceConnection,
} from "@shared/models";
import { serializeCustomFields } from "@shared/utils/custom-fields";
import {
  decryptCredential,
  encryptCredential,
} from "@shared/security/credential-cipher";
import {
  GoogleCalendarAdapter,
  type GoogleCalendarCredentials,
  type GoogleCalendarSummary,
} from "@modules/lead-sources/google-calendar.adapter";

export interface CreateCrmRecordInput {
  contactId?: string | null;
  primaryContactId?: string | null;
  accountId?: string | null;
  title: string;
  recordType?: "lead" | "deal";
  labels?: string[];
  sourceOrigin?: string;
  sourceChannel?: string;
  sourceChannelId?: string;
  company?: string;
  value?: number;
  currency?: "USD" | "INR" | "EUR" | "GBP";
  stage?: CrmRecordStage;
  ownerId?: string | null;
  expectedCloseAt?: string | null;
  nextAction?: string;
  customFields?: Record<string, unknown>;
  sourceSubmissionId?: string;
}

export type UpdateCrmRecordInput = Partial<
  Omit<CreateCrmRecordInput, "contactId" | "stage">
>;

export class CrmRecordsService {
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
      const usedStage = await CrmRecord.findOne({
        organizationId,
        stage: { $in: protectedStageIds },
        recordType: { $in: ["deal", null] },
        archivedAt: null,
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
          `Move all records out of ${removed?.label || "this stage"} before ${action}`,
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
      { upsert: true, returnDocument: "after", runValidators: true },
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

  async list(organizationId: string, recordType: "lead" | "deal" = "deal") {
    const records = await CrmRecord.find({
      organizationId,
      archivedAt: null,
      recordType: recordType === "deal" ? { $in: ["deal", null] } : "lead",
    })
      .populate(
        "contactId",
        "name email phone emails phones company lifecycleStage",
      )
      .populate(
        "primaryContactId",
        "name email phone emails phones company lifecycleStage",
      )
      .populate(
        "accountId",
        "name website linkedinProfile industry address annualRevenue numberOfEmployees labels customFields",
      )
      .populate("ownerId", "name email")
      .sort({ stage: 1, position: 1, updatedAt: -1 })
      .lean();

    return records.map((record: any) => ({
      id: record._id.toString(),
      title: record.title,
      recordType: record.recordType || "deal",
      labels: record.labels || [],
      sourceOrigin: record.sourceOrigin || "manual",
      sourceChannel: record.sourceChannel || "",
      sourceChannelId: record.sourceChannelId || "",
      company: record.accountId?.name || record.company,
      account: record.accountId
        ? {
            id: record.accountId._id.toString(),
            name: record.accountId.name,
            website: record.accountId.website || "",
            linkedinProfile: record.accountId.linkedinProfile || "",
            industry: record.accountId.industry || "",
            address: record.accountId.address || "",
            annualRevenue: record.accountId.annualRevenue ?? null,
            numberOfEmployees: record.accountId.numberOfEmployees ?? null,
            labels: record.accountId.labels || [],
            customFields: serializeCustomFields(record.accountId.customFields),
          }
        : null,
      value: record.value,
      currency: record.currency,
      stage: record.stage,
      color: record.color || "slate",
      position: record.position || 0,
      priority: record.priority || 1,
      expectedCloseAt: record.expectedCloseAt?.toISOString() || null,
      nextAction: record.nextAction || "",
      activities: (record.activities || []).map((activity: any) => ({
        id: activity.id,
        type: activity.type || "note",
        content: activity.content,
        category: activity.category || "todo",
        dueAt: activity.dueAt ? new Date(activity.dueAt).toISOString() : null,
        durationMinutes: activity.durationMinutes || 60,
        completedAt: activity.completedAt
          ? new Date(activity.completedAt).toISOString()
          : null,
        createdAt: new Date(activity.createdAt).toISOString(),
        customFields: serializeCustomFields(activity.customFields),
        googleCalendarEventId: activity.googleCalendarEventId || null,
        googleCalendarId: activity.googleCalendarId || null,
        googleCalendarEventUrl: activity.googleCalendarEventUrl || null,
        googleMeetUrl: activity.googleMeetUrl || null,
        calendarSyncStatus: activity.calendarSyncStatus || null,
        calendarSyncError: activity.calendarSyncError || null,
      })),
      contact:
        record.primaryContactId || record.contactId
          ? {
              id: (record.primaryContactId || record.contactId)._id.toString(),
              name: (record.primaryContactId || record.contactId).name,
              email: (record.primaryContactId || record.contactId).email,
              phone: (record.primaryContactId || record.contactId).phone,
              phones:
                (record.primaryContactId || record.contactId).phones || [],
              emails:
                (record.primaryContactId || record.contactId).emails || [],
              company: (record.primaryContactId || record.contactId).company,
            }
          : null,
      owner: record.ownerId
        ? {
            id: record.ownerId._id.toString(),
            name: record.ownerId.name,
            email: record.ownerId.email,
          }
        : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      customFields: serializeCustomFields(record.customFields),
      archivedAt: record.archivedAt?.toISOString() || null,
    }));
  }

  async create(organizationId: string, input: CreateCrmRecordInput) {
    const orgId = new Types.ObjectId(organizationId);
    const pipelineStage = await this.getStage(organizationId, input.stage);
    const recordType = input.recordType || "deal";
    const position = await CrmRecord.countDocuments({
      organizationId: orgId,
      stage: pipelineStage.id,
      recordType: recordType === "deal" ? { $in: ["deal", null] } : "lead",
    });
    const customFields = input.customFields || {};
    const primaryContactId = input.primaryContactId || input.contactId;
    const contact = primaryContactId
      ? await Contact.findOne({
          _id: new Types.ObjectId(primaryContactId),
          organizationId: orgId,
        })
      : null;
    if (primaryContactId && !contact) throw new Error("Contact not found");
    const resolvedAccountId = input.accountId || contact?.accountId?.toString();
    const account = resolvedAccountId
      ? await Account.findOne({
          _id: new Types.ObjectId(resolvedAccountId),
          organizationId: orgId,
          archivedAt: null,
        })
      : null;
    if (resolvedAccountId && !account) throw new Error("Company not found");
    if (!contact && !account)
      throw new Error("A company or primary contact is required");
    if (
      contact?.accountId &&
      account &&
      contact.accountId.toString() !== account._id.toString()
    ) {
      throw new Error("Primary contact must belong to the selected company");
    }

    if (input.ownerId) {
      const membership = await Membership.exists({
        organizationId: orgId,
        userId: new Types.ObjectId(input.ownerId),
        inviteStatus: "accepted",
      });
      if (!membership)
        throw new Error(
          "CRM record owner must be an active organization member",
        );
    }

    const record = await CrmRecord.create({
      organizationId: orgId,
      contactId: contact?._id || null,
      primaryContactId: contact?._id || null,
      accountId: account?._id || null,
      title: input.title,
      recordType,
      labels: input.labels || [],
      sourceOrigin: input.sourceOrigin || "manual",
      sourceChannel: input.sourceChannel || "",
      sourceChannelId: input.sourceChannelId || "",
      company: account?.name || input.company || contact?.company,
      value: input.value || 0,
      currency: input.currency || "USD",
      stage: pipelineStage.id,
      position,
      ownerId: input.ownerId
        ? new Types.ObjectId(input.ownerId)
        : contact?.ownerId || account?.ownerId || null,
      expectedCloseAt: input.expectedCloseAt
        ? new Date(input.expectedCloseAt)
        : null,
      nextAction: input.nextAction || "",
      customFields,
      sourceSubmissionId: input.sourceSubmissionId
        ? new Types.ObjectId(input.sourceSubmissionId)
        : null,
    });

    if (contact && (input.recordType || "deal") === "deal") {
      await this.syncContactLifecycle(
        organizationId,
        contact._id.toString(),
        pipelineStage,
      );
    }
    return record;
  }

  async update(
    organizationId: string,
    recordId: string,
    input: UpdateCrmRecordInput,
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
          "CRM record owner must be an active organization member",
        );
      }
    }

    const updates: Record<string, unknown> = {};
    if (input.title !== undefined) updates.title = input.title.trim();
    if (input.labels !== undefined) updates.labels = input.labels;
    if (input.sourceOrigin !== undefined)
      updates.sourceOrigin = input.sourceOrigin.trim();
    if (input.sourceChannel !== undefined)
      updates.sourceChannel = input.sourceChannel.trim();
    if (input.sourceChannelId !== undefined)
      updates.sourceChannelId = input.sourceChannelId.trim();
    if (input.company !== undefined) updates.company = input.company.trim();
    if (input.accountId !== undefined) {
      if (input.accountId) {
        const account = await Account.findOne({
          _id: new Types.ObjectId(input.accountId),
          organizationId: orgId,
          archivedAt: null,
        });
        if (!account) throw new Error("Company not found");
        updates.accountId = account._id;
        updates.company = account.name;
      } else {
        updates.accountId = null;
      }
    }
    if (input.primaryContactId !== undefined) {
      if (input.primaryContactId) {
        const contact = await Contact.findOne({
          _id: new Types.ObjectId(input.primaryContactId),
          organizationId: orgId,
        });
        if (!contact) throw new Error("Contact not found");
        updates.primaryContactId = contact._id;
        updates.contactId = contact._id;
      } else {
        updates.primaryContactId = null;
        updates.contactId = null;
      }
    }
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
    if (input.customFields !== undefined)
      updates.customFields = input.customFields;

    const record = await CrmRecord.findOneAndUpdate(
      { _id: recordId, organizationId: orgId },
      {
        $set: updates,
        $push: {
          activities: {
            $each: [
              {
                id: `activity-${Date.now()}`,
                type: "status",
                content: "CRM record details updated",
                createdAt: new Date(),
              },
            ],
            $position: 0,
          },
        },
      },
      { returnDocument: "after", runValidators: true },
    );
    if (!record) throw new Error("CRM record not found");
    return record;
  }

  async remove(organizationId: string, recordId: string) {
    const record = await CrmRecord.findOneAndDelete({
      _id: recordId,
      organizationId,
    });
    if (!record) throw new Error("CRM record not found");

    const contactId = record.primaryContactId || record.contactId;
    if (contactId) {
      await this.syncContactFromRecords(organizationId, contactId.toString());
      await this.syncContactNextFollowUp(organizationId, contactId.toString());
    }
  }

  async convertToDeal(organizationId: string, recordId: string) {
    const orgId = new Types.ObjectId(organizationId);
    const lead = await CrmRecord.findOne({
      _id: recordId,
      organizationId: orgId,
      recordType: "lead",
      archivedAt: null,
    });
    if (!lead) throw new Error("Lead not found");

    const pipelineStage = await this.getStage(organizationId);
    const position = await CrmRecord.countDocuments({
      organizationId: orgId,
      stage: pipelineStage.id,
      recordType: { $in: ["deal", null] },
      archivedAt: null,
    });
    lead.recordType = "deal";
    lead.stage = pipelineStage.id;
    lead.position = position;
    lead.activities.unshift({
      id: `activity-${Date.now()}`,
      type: "status",
      content: "Lead converted to deal",
      category: "todo",
      dueAt: null,
      durationMinutes: 60,
      completedAt: null,
      createdAt: new Date(),
    });
    await lead.save();

    const contactId = lead.primaryContactId || lead.contactId;
    if (contactId) {
      await this.syncContactLifecycle(
        organizationId,
        contactId.toString(),
        pipelineStage,
        lead._id.toString(),
      );
    }
    return lead;
  }

  async updateStage(
    organizationId: string,
    recordId: string,
    stage: CrmRecordStage,
    recordType: "lead" | "deal" = "deal",
  ) {
    const pipelineStage = await this.getStage(organizationId, stage);
    const existing = await CrmRecord.findOne({
      _id: recordId,
      organizationId,
    });
    if (!existing) throw new Error("CRM record not found");
    const previousStage = existing.stage;
    const record = await CrmRecord.findOneAndUpdate(
      { _id: recordId, organizationId },
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
      { returnDocument: "after", runValidators: true },
    );
    if (!record) throw new Error("CRM record not found");

    const contactId = record.primaryContactId || record.contactId;
    if (contactId && recordType === "deal") {
      await this.syncContactLifecycle(
        organizationId,
        contactId.toString(),
        pipelineStage,
        record._id.toString(),
      );
    }
    return record;
  }

  async updateColor(organizationId: string, recordId: string, color: string) {
    const record = await CrmRecord.findOneAndUpdate(
      { _id: recordId, organizationId },
      { $set: { color } },
      { returnDocument: "after", runValidators: true },
    );
    if (!record) throw new Error("CRM record not found");
    return record;
  }

  async updateNextAction(
    organizationId: string,
    recordId: string,
    nextAction: string,
  ) {
    const record = await CrmRecord.findOneAndUpdate(
      { _id: recordId, organizationId },
      { $set: { nextAction: nextAction.trim() } },
      { returnDocument: "after", runValidators: true },
    );
    if (!record) throw new Error("CRM record not found");
    return record;
  }

  async addActivity(
    organizationId: string,
    recordId: string,
    content: string,
    dueAt?: string | null,
    category?: "todo" | "email" | "call" | "meeting" | "document",
    customFieldValues?: Record<string, unknown>,
    durationMinutes = 60,
  ) {
    const customFields = customFieldValues || {};
    const activity = {
      id: `activity-${Date.now()}`,
      type: dueAt ? ("planned" as const) : ("note" as const),
      content: content.trim(),
      category: category || "todo",
      dueAt: dueAt ? new Date(dueAt) : null,
      durationMinutes,
      completedAt: null,
      createdAt: new Date(),
      customFields,
    };
    const record = await CrmRecord.findOneAndUpdate(
      { _id: recordId, organizationId },
      { $push: { activities: { $each: [activity], $position: 0 } } },
      { returnDocument: "after", runValidators: true },
    );
    if (!record) throw new Error("CRM record not found");
    if (activity.dueAt) {
      const sync = await this.createGoogleCalendarActivity(
        organizationId,
        record,
        { ...activity, dueAt: activity.dueAt },
      );
      if (sync) Object.assign(activity, sync);
    }
    const contactId = record.primaryContactId || record.contactId;
    if (activity.dueAt && contactId) {
      await this.syncContactNextFollowUp(organizationId, contactId.toString());
    }
    return activity;
  }

  // Mirrors scheduled CRM activities to the connected account's writable calendar.
  // Calendar failures are recorded without losing the CRM activity.
  private async createGoogleCalendarActivity(
    organizationId: string,
    record: any,
    activity: {
      id: string;
      content: string;
      dueAt: Date;
      durationMinutes: number;
      category: "todo" | "email" | "call" | "meeting" | "document";
    },
  ) {
    const connection = await LeadSourceConnection.findOne({
      organizationId,
      provider: "google_calendar",
      status: "active",
    }).select("+credentialsCiphertext");
    if (!connection) return null;

    const calendars = ((connection.metadata as any)?.calendars || []) as
      | GoogleCalendarSummary[]
      | undefined;
    const isWritable = (item: GoogleCalendarSummary) =>
      ["owner", "writer"].includes(item.accessRole);
    const calendar =
      calendars?.find((item) => item.primary && isWritable(item)) ||
      calendars?.find(isWritable);
    if (!calendar) {
      return {
        calendarSyncStatus: "failed" as const,
        calendarSyncError: "No writable Google Calendar is available",
      };
    }

    try {
      const adapter = new GoogleCalendarAdapter();
      const stored = JSON.parse(
        decryptCredential(connection.credentialsCiphertext),
      ) as GoogleCalendarCredentials;
      const credentials = await adapter.refresh(stored);
      if (credentials.accessToken !== stored.accessToken) {
        connection.credentialsCiphertext = encryptCredential(
          JSON.stringify(credentials),
        );
        await connection.save();
      }
      const contactId = record.primaryContactId || record.contactId;
      const contact = contactId
        ? await Contact.findOne({ _id: contactId, organizationId })
            .select("email")
            .lean()
        : null;
      const [summary, ...noteLines] = activity.content.split("\n");
      const notes = noteLines.join("\n").trim();
      const event = await adapter.createEvent(
        credentials.accessToken,
        calendar.id,
        {
          summary: summary.trim(),
          description: [
            notes,
            `CRM record: ${record.title}`,
            `Activity type: ${activity.category}`,
          ]
            .filter(Boolean)
            .join("\n\n"),
          start: activity.dueAt,
          end: new Date(
            activity.dueAt.getTime() + activity.durationMinutes * 60 * 1000,
          ),
          attendeeEmail:
            activity.category === "meeting" ? contact?.email : undefined,
          requestId: activity.id,
          createConference: activity.category === "meeting",
        },
      );
      const fields = {
        googleCalendarEventId: event.id,
        googleCalendarId: calendar.id,
        googleCalendarEventUrl: event.htmlLink || null,
        googleMeetUrl: event.hangoutLink || null,
        calendarSyncStatus: "synced" as const,
        calendarSyncError: null,
      };
      await CrmRecord.updateOne(
        { _id: record._id, "activities.id": activity.id },
        {
          $set: Object.fromEntries(
            Object.entries(fields).map(([key, value]) => [
              `activities.$.${key}`,
              value,
            ]),
          ),
        },
      );
      return fields;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Calendar sync failed";
      await CrmRecord.updateOne(
        { _id: record._id, "activities.id": activity.id },
        {
          $set: {
            "activities.$.calendarSyncStatus": "failed",
            "activities.$.calendarSyncError": message.slice(0, 500),
          },
        },
      );
      return {
        calendarSyncStatus: "failed" as const,
        calendarSyncError: message.slice(0, 500),
      };
    }
  }

  async updatePriority(
    organizationId: string,
    recordId: string,
    priority: 1 | 2 | 3,
  ) {
    const record = await CrmRecord.findOneAndUpdate(
      { _id: recordId, organizationId },
      { $set: { priority } },
      { returnDocument: "after", runValidators: true },
    );
    if (!record) throw new Error("CRM record not found");
    return record;
  }

  async completeActivity(
    organizationId: string,
    recordId: string,
    activityId: string,
  ) {
    const record = await CrmRecord.findOneAndUpdate(
      { _id: recordId, organizationId, "activities.id": activityId },
      { $set: { "activities.$.completedAt": new Date() } },
      { returnDocument: "after" },
    );
    if (!record) throw new Error("Activity not found");
    const contactId = record.primaryContactId || record.contactId;
    if (contactId) {
      await this.syncContactNextFollowUp(organizationId, contactId.toString());
    }
    return record;
  }

  async updateActivity(
    organizationId: string,
    recordId: string,
    activityId: string,
    updates: {
      content?: string;
      dueAt?: string | null;
      durationMinutes?: number;
      category?: "todo" | "email" | "call" | "meeting" | "document";
      customFields?: Record<string, unknown>;
    },
  ) {
    const record = await CrmRecord.findOne({
      _id: recordId,
      organizationId,
    });
    const activity = record?.activities.find((item) => item.id === activityId);
    if (!record || !activity) throw new Error("Activity not found");
    if (updates.content !== undefined)
      activity.content = updates.content.trim();
    if (updates.dueAt !== undefined)
      activity.dueAt = updates.dueAt ? new Date(updates.dueAt) : null;
    if (updates.durationMinutes !== undefined)
      activity.durationMinutes = updates.durationMinutes;
    if (updates.category !== undefined) activity.category = updates.category;
    if (updates.customFields !== undefined)
      activity.customFields = updates.customFields;
    await record.save();
    const contactId = record.primaryContactId || record.contactId;
    if (contactId) {
      await this.syncContactNextFollowUp(organizationId, contactId.toString());
    }
    return activity;
  }

  async deleteActivity(
    organizationId: string,
    recordId: string,
    activityId: string,
  ) {
    const result = await CrmRecord.updateOne(
      {
        _id: recordId,
        organizationId,
        "activities.id": activityId,
      },
      { $pull: { activities: { id: activityId } } },
    );
    if (result.modifiedCount === 0) {
      throw new Error("Activity not found");
    }
  }

  async move(
    organizationId: string,
    recordId: string,
    stage: CrmRecordStage,
    position: number,
    recordType: "lead" | "deal" = "deal",
  ) {
    const pipelineStage = await this.getStage(organizationId, stage);
    const record = await CrmRecord.findOne({
      _id: recordId,
      organizationId,
    });
    if (!record) throw new Error("CRM record not found");

    const targetItems = await CrmRecord.find({
      organizationId,
      stage: pipelineStage.id,
      _id: { $ne: record._id },
      recordType: recordType === "deal" ? { $in: ["deal", null] } : "lead",
    }).sort({ position: 1, updatedAt: -1 });
    const targetPosition = Math.min(Math.max(position, 0), targetItems.length);
    targetItems.splice(targetPosition, 0, record);

    const previousStage = record.stage;
    record.stage = pipelineStage.id;
    await CrmRecord.bulkWrite(
      targetItems.map((item, index) => ({
        updateOne: {
          filter: { _id: item._id, organizationId },
          update: { $set: { stage: pipelineStage.id, position: index } },
        },
      })),
    );

    if (previousStage !== pipelineStage.id) {
      await CrmRecord.updateOne(
        { _id: record._id, organizationId },
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

    const contactId = record.primaryContactId || record.contactId;
    if (contactId && recordType === "deal") {
      await this.syncContactLifecycle(
        organizationId,
        contactId.toString(),
        pipelineStage,
        record._id.toString(),
      );
    }
    return record;
  }

  private async syncContactLifecycle(
    organizationId: string,
    contactId: string,
    stage: IPipelineStage,
    currentRecordId?: string,
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
      const otherActive = await CrmRecord.exists({
        organizationId,
        $or: [{ contactId }, { primaryContactId: contactId }],
        stage: { $nin: closedStageIds },
        ...(currentRecordId ? { _id: { $ne: currentRecordId } } : {}),
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
      { $set: { lifecycleStage: "record", leadStatus: "follow_up" } },
    );
  }

  private async syncContactNextFollowUp(
    organizationId: string,
    contactId: string,
  ) {
    const records = await CrmRecord.find({
      organizationId,
      $or: [{ contactId }, { primaryContactId: contactId }],
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
    const pendingDates = records.flatMap((item) =>
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

  private async syncContactFromRecords(
    organizationId: string,
    contactId: string,
  ) {
    const pipeline = await this.getPipeline(organizationId);
    const records = await CrmRecord.find({
      organizationId,
      $or: [{ contactId }, { primaryContactId: contactId }],
    })
      .select("stage")
      .lean();
    const stageTypes = records.map(
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
        { $set: { lifecycleStage: "record", leadStatus: "follow_up" } },
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
      { _id: contactId, organizationId, lifecycleStage: "record" },
      { $set: { lifecycleStage: "qualified", leadStatus: "follow_up" } },
    );
  }
}
