import { apiClient } from "@/shared/lib/api-client";
import type {
  AccountActivityPayload,
  AccountDetail,
  AccountSummary,
  AccountWritePayload,
} from "../types/types";

interface ListResponse {
  data: {
    accounts: AccountSummary[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const accountsApi = {
  async list(search = "", limit = 100) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (search.trim()) params.set("q", search.trim());
    const response = await apiClient.get<ListResponse>(
      `/crm/organizations?${params.toString()}`,
    );
    return response.data;
  },
  async get(id: string) {
    const response = await apiClient.get<{ data: AccountDetail }>(
      `/crm/organizations/${id}`,
    );
    return response.data;
  },
  async create(payload: AccountWritePayload) {
    const response = await apiClient.post<{
      data: { account: { _id: string } };
    }>("/crm/organizations", payload);
    return response.data.account;
  },
  async update(id: string, payload: Partial<AccountWritePayload>) {
    await apiClient.patch(`/crm/organizations/${id}`, payload);
  },
  async archive(id: string) {
    await apiClient.post(`/crm/organizations/${id}/archive`);
  },
  async addNote(id: string, content: string) {
    await apiClient.post(`/crm/organizations/${id}/notes`, { content });
  },
  async updateNote(
    id: string,
    noteId: string,
    payload: { content?: string; pinned?: boolean },
  ) {
    await apiClient.patch(
      `/crm/organizations/${id}/notes/${encodeURIComponent(noteId)}`,
      payload,
    );
  },
  async deleteNote(id: string, noteId: string) {
    await apiClient.delete(
      `/crm/organizations/${id}/notes/${encodeURIComponent(noteId)}`,
    );
  },
  async addActivity(id: string, payload: AccountActivityPayload) {
    await apiClient.post(`/crm/organizations/${id}/activities`, payload);
  },
  async updateActivityStatus(
    id: string,
    activityId: string,
    status: "scheduled" | "done",
  ) {
    await apiClient.patch(
      `/crm/organizations/${id}/activities/${encodeURIComponent(activityId)}/status`,
      { status },
    );
  },
  async updateActivity(
    id: string,
    activityId: string,
    payload: Partial<AccountActivityPayload>,
  ) {
    await apiClient.patch(
      `/crm/organizations/${id}/activities/${encodeURIComponent(activityId)}`,
      payload,
    );
  },
  async deleteActivity(id: string, activityId: string) {
    await apiClient.delete(
      `/crm/organizations/${id}/activities/${encodeURIComponent(activityId)}`,
    );
  },
  async addTimelineItem(
    id: string,
    payload: {
      type: "file" | "document";
      title: string;
      fileName: string;
      fileKey: string;
      mimeType?: string;
      size?: number;
    },
  ) {
    await apiClient.post(`/crm/organizations/${id}/timeline`, payload);
  },
  async updateTimelineItem(id: string, itemId: string, content: string) {
    await apiClient.patch(
      `/crm/organizations/${id}/timeline/${encodeURIComponent(itemId)}`,
      { content },
    );
  },
  async deleteTimelineItem(id: string, itemId: string) {
    await apiClient.delete(
      `/crm/organizations/${id}/timeline/${encodeURIComponent(itemId)}`,
    );
  },
};
