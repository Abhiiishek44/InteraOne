import { CrmRecord, type CrmRecordStage } from "@shared/models";
import {
  CrmRecordsService,
  type CreateCrmRecordInput,
  type UpdateCrmRecordInput,
} from "./crm-records.service";

export type CrmRecordType = "lead" | "deal";

export abstract class ScopedCrmRecordsService extends CrmRecordsService {
  protected constructor(readonly recordType: CrmRecordType) {
    super();
  }

  private async assertRecordType(organizationId: string, recordId: string) {
    const record = await CrmRecord.exists({
      _id: recordId,
      organizationId,
      archivedAt: null,
      recordType: this.recordType === "deal" ? { $in: ["deal", null] } : "lead",
    });
    if (!record) {
      throw new Error(
        `${this.recordType === "lead" ? "Lead" : "Deal"} not found`,
      );
    }
  }

  listRecords(organizationId: string) {
    return super.list(organizationId, this.recordType);
  }

  createRecord(organizationId: string, input: CreateCrmRecordInput) {
    return super.create(organizationId, {
      ...input,
      recordType: this.recordType,
    });
  }

  async updateRecord(
    organizationId: string,
    recordId: string,
    input: UpdateCrmRecordInput,
  ) {
    await this.assertRecordType(organizationId, recordId);
    return super.update(organizationId, recordId, input);
  }

  async removeRecord(organizationId: string, recordId: string) {
    await this.assertRecordType(organizationId, recordId);
    return super.remove(organizationId, recordId);
  }

  async updateRecordStage(
    organizationId: string,
    recordId: string,
    stage: CrmRecordStage,
  ) {
    await this.assertRecordType(organizationId, recordId);
    return super.updateStage(organizationId, recordId, stage, this.recordType);
  }

  async updateRecordColor(
    organizationId: string,
    recordId: string,
    color: Parameters<CrmRecordsService["updateColor"]>[2],
  ) {
    await this.assertRecordType(organizationId, recordId);
    return super.updateColor(organizationId, recordId, color);
  }

  async updateRecordPriority(
    organizationId: string,
    recordId: string,
    priority: 1 | 2 | 3,
  ) {
    await this.assertRecordType(organizationId, recordId);
    return super.updatePriority(organizationId, recordId, priority);
  }

  async updateRecordNextAction(
    organizationId: string,
    recordId: string,
    nextAction: string,
  ) {
    await this.assertRecordType(organizationId, recordId);
    return super.updateNextAction(organizationId, recordId, nextAction);
  }

  async moveRecord(
    organizationId: string,
    recordId: string,
    stage: CrmRecordStage,
    position: number,
  ) {
    await this.assertRecordType(organizationId, recordId);
    return super.move(
      organizationId,
      recordId,
      stage,
      position,
      this.recordType,
    );
  }

  async addRecordActivity(
    organizationId: string,
    recordId: string,
    content: string,
    dueAt?: string,
    category?: "todo" | "email" | "call" | "meeting" | "document",
    customFields?: Record<string, unknown>,
    durationMinutes?: number,
  ) {
    await this.assertRecordType(organizationId, recordId);
    return super.addActivity(
      organizationId,
      recordId,
      content,
      dueAt,
      category,
      customFields,
      durationMinutes,
    );
  }

  async completeRecordActivity(
    organizationId: string,
    recordId: string,
    activityId: string,
  ) {
    await this.assertRecordType(organizationId, recordId);
    return super.completeActivity(organizationId, recordId, activityId);
  }

  async updateRecordActivity(
    organizationId: string,
    recordId: string,
    activityId: string,
    input: Parameters<CrmRecordsService["updateActivity"]>[3],
  ) {
    await this.assertRecordType(organizationId, recordId);
    return super.updateActivity(organizationId, recordId, activityId, input);
  }

  async deleteRecordActivity(
    organizationId: string,
    recordId: string,
    activityId: string,
  ) {
    await this.assertRecordType(organizationId, recordId);
    return super.deleteActivity(organizationId, recordId, activityId);
  }
}
