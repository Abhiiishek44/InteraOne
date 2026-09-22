import { apiClient } from "@/shared/lib/api-client";
import type { AccountDetail, AccountSummary, AccountWritePayload } from "../types/types";

interface ListResponse {
  data: { accounts: AccountSummary[]; total: number; page: number; limit: number; totalPages: number };
}

export const accountsApi = {
  async list(search = "", limit = 100) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (search.trim()) params.set("q", search.trim());
    const response = await apiClient.get<ListResponse>(`/accounts?${params.toString()}`);
    return response.data;
  },
  async get(id: string) {
    const response = await apiClient.get<{ data: AccountDetail }>(`/accounts/${id}`);
    return response.data;
  },
  async create(payload: AccountWritePayload) {
    const response = await apiClient.post<{ data: { account: { _id: string } } }>("/accounts", payload);
    return response.data.account;
  },
  async update(id: string, payload: Partial<AccountWritePayload>) {
    await apiClient.patch(`/accounts/${id}`, payload);
  },
  async archive(id: string) {
    await apiClient.post(`/accounts/${id}/archive`);
  },
  async addNote(id: string, content: string) {
    await apiClient.post(`/accounts/${id}/notes`, { content });
  },
};
