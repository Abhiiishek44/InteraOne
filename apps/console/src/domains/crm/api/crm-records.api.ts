import { apiClient } from "@/shared/lib/api-client";
import type {
  CreateCrmRecordPayload,
  CrmRecord,
  CrmRecordColor,
  CrmRecordStage,
  SalesPipeline,
  UpdatePipelinePayload,
  UpdateCrmRecordPayload,
} from "../types/types";

interface CrmRecordsResponse {
  data: { deals?: CrmRecord[]; leads?: CrmRecord[] };
}

interface PipelineResponse {
  data: { pipeline: SalesPipeline };
}

interface ActivityResponse {
  data: { activity: CrmRecord["activities"][number] };
}

export const crmRecordsApi = {
  async list(recordType: "lead" | "deal" = "deal"): Promise<CrmRecord[]> {
    const response = await apiClient.get<CrmRecordsResponse>(
      recordType === "lead" ? "/leads" : "/deals",
    );
    return recordType === "lead"
      ? response.data?.leads || []
      : response.data?.deals || [];
  },

  async getPipeline(): Promise<SalesPipeline> {
    const response = await apiClient.get<PipelineResponse>("/deals/pipeline");
    return response.data.pipeline;
  },

  async updatePipeline(payload: UpdatePipelinePayload): Promise<SalesPipeline> {
    const response = await apiClient.put<PipelineResponse>(
      "/deals/pipeline",
      payload,
    );
    return response.data.pipeline;
  },

  async create(payload: CreateCrmRecordPayload): Promise<{ _id: string }> {
    const { recordType = "deal", ...recordPayload } = payload;
    const response = await apiClient.post<{
      data: { deal?: { _id: string }; lead?: { _id: string } };
    }>(recordType === "lead" ? "/leads" : "/deals", recordPayload);
    return (recordType === "lead" ? response.data.lead : response.data.deal)!;
  },

  async update(
    id: string,
    payload: UpdateCrmRecordPayload,
    recordType: "lead" | "deal" = "deal",
  ): Promise<void> {
    await apiClient.patch(
      `/${recordType === "lead" ? "leads" : "deals"}/${id}`,
      payload,
    );
  },

  async remove(
    id: string,
    recordType: "lead" | "deal" = "deal",
  ): Promise<void> {
    await apiClient.delete(
      `/${recordType === "lead" ? "leads" : "deals"}/${id}`,
    );
  },

  async convertLead(id: string): Promise<void> {
    await apiClient.post(`/leads/${id}/convert-to-deal`);
  },

  async updateStage(
    id: string,
    stage: CrmRecordStage,
    recordType: "lead" | "deal" = "deal",
  ): Promise<void> {
    await apiClient.patch(
      `/${recordType === "lead" ? "leads" : "deals"}/${id}/stage`,
      { stage },
    );
  },

  async updateColor(
    id: string,
    color: CrmRecordColor,
    recordType: "lead" | "deal" = "deal",
  ): Promise<void> {
    await apiClient.patch(
      `/${recordType === "lead" ? "leads" : "deals"}/${id}/color`,
      { color },
    );
  },

  async move(
    id: string,
    stage: CrmRecordStage,
    position: number,
    recordType: "lead" | "deal" = "deal",
  ): Promise<void> {
    await apiClient.patch(
      `/${recordType === "lead" ? "leads" : "deals"}/${id}/move`,
      { stage, position },
    );
  },

  async updateNextAction(
    id: string,
    nextAction: string,
    recordType: "lead" | "deal" = "deal",
  ): Promise<void> {
    await apiClient.patch(
      `/${recordType === "lead" ? "leads" : "deals"}/${id}/next-action`,
      { nextAction },
    );
  },

  async addActivity(
    id: string,
    content: string,
    dueAt?: string,
    category?: "todo" | "email" | "call" | "meeting" | "document",
    customFields?: Record<string, unknown>,
    durationMinutes?: number,
    recordType: "lead" | "deal" = "deal",
  ): Promise<CrmRecord["activities"][number]> {
    const response = await apiClient.post<ActivityResponse>(
      `/${recordType === "lead" ? "leads" : "deals"}/${id}/activities`,
      {
        content,
        dueAt,
        category,
        customFields,
        durationMinutes,
      },
    );
    return response.data.activity;
  },

  async updatePriority(
    id: string,
    priority: 1 | 2 | 3,
    recordType: "lead" | "deal" = "deal",
  ): Promise<void> {
    await apiClient.patch(
      `/${recordType === "lead" ? "leads" : "deals"}/${id}/priority`,
      { priority },
    );
  },

  async completeActivity(
    id: string,
    activityId: string,
    recordType: "lead" | "deal" = "deal",
  ): Promise<void> {
    await apiClient.patch(
      `/${recordType === "lead" ? "leads" : "deals"}/${id}/activities/${activityId}/complete`,
    );
  },

  async updateActivity(
    id: string,
    activityId: string,
    payload: {
      content?: string;
      dueAt?: string | null;
      durationMinutes?: number;
      category?: "todo" | "email" | "call" | "meeting" | "document";
      customFields?: Record<string, unknown>;
    },
    recordType: "lead" | "deal" = "deal",
  ): Promise<void> {
    await apiClient.patch(
      `/${recordType === "lead" ? "leads" : "deals"}/${id}/activities/${encodeURIComponent(activityId)}`,
      payload,
    );
  },

  async deleteActivity(
    id: string,
    activityId: string,
    recordType: "lead" | "deal" = "deal",
  ): Promise<void> {
    await apiClient.delete(
      `/${recordType === "lead" ? "leads" : "deals"}/${id}/activities/${encodeURIComponent(activityId)}`,
    );
  },

  async updateNote(
    id: string,
    activityId: string,
    content: string,
    recordType: "lead" | "deal" = "deal",
  ) {
    return this.updateActivity(id, activityId, { content }, recordType);
  },

  async deleteNote(
    id: string,
    activityId: string,
    recordType: "lead" | "deal" = "deal",
  ) {
    return this.deleteActivity(id, activityId, recordType);
  },
};
