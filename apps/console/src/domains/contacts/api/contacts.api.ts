import { apiClient } from "@/shared/lib/api-client";
import type {
  ContactListItem,
  ContactConflictItem,
  ContactNote,
  ContactOwner,
  ContactWritePayload,
} from "../types/types";

interface ApiDataResponse<T> {
  data: T;
}

interface CreatedContact {
  _id: string;
  id?: string;
}

interface ContactsResponse {
  success: boolean;
  message: string;
  data: {
    contacts: ContactListItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ContactListQuery {
  search?: string;
  page?: number;
  limit?: number;
  lifecycleStage?: string;
  leadStatus?: string;
  tags?: string[];
  activityRange?: string;
  conversationRange?: string;
  sort?: string;
}

export interface ContactListPage {
  contacts: ContactListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ConflictsResponse {
  success: boolean;
  message: string;
  data: ContactConflictItem[];
}

class ContactsApi {
  async getContacts(): Promise<ContactListItem[]> {
    const response = await apiClient.get<ContactsResponse>(
      "/contacts?limit=300",
    );
    return response.data?.contacts || [];
  }

  async getContactsPage(query: ContactListQuery): Promise<ContactListPage> {
    const params = new URLSearchParams();
    if (query.search?.trim()) params.set("q", query.search.trim());
    if (query.page) params.set("page", String(query.page));
    if (query.limit) params.set("limit", String(query.limit));
    if (query.lifecycleStage && query.lifecycleStage !== "all") {
      params.set("lifecycleStage", query.lifecycleStage);
    }
    if (query.leadStatus && query.leadStatus !== "all") {
      params.set("leadStatus", query.leadStatus);
    }
    if (query.tags?.length) params.set("tags", query.tags.join(","));
    if (query.activityRange && query.activityRange !== "all") {
      params.set("activityRange", query.activityRange);
    }
    if (query.conversationRange && query.conversationRange !== "all") {
      params.set("conversationRange", query.conversationRange);
    }
    if (query.sort) params.set("sort", query.sort);

    const response = await apiClient.get<ContactsResponse>(
      `/contacts?${params.toString()}`,
    );
    return {
      contacts: response.data?.contacts || [],
      total: response.data?.total || 0,
      page: response.data?.page || query.page || 1,
      limit: response.data?.limit || query.limit || 10,
      totalPages: response.data?.totalPages || 1,
    };
  }

  async createContact(
    payload: ContactWritePayload & { name: string },
  ): Promise<CreatedContact> {
    const res = await apiClient.post<
      ApiDataResponse<{ contact: CreatedContact }>
    >("/contacts", payload);
    return res.data?.contact;
  }

  async getContactOwners(): Promise<ContactOwner[]> {
    const res =
      await apiClient.get<ApiDataResponse<{ owners: ContactOwner[] }>>(
        "/contacts/owners",
      );
    return res.data?.owners || [];
  }

  async deleteContacts(ids: string[]): Promise<void> {
    await apiClient.delete("/contacts", { ids });
  }

  async bulkAddTags(ids: string[], tags: string[]): Promise<void> {
    await apiClient.post("/contacts/tags", { ids, tags });
  }

  async addNote(id: string, content: string): Promise<ContactNote> {
    const res = await apiClient.post<ApiDataResponse<ContactNote>>(
      `/contacts/${id}/notes`,
      { content },
    );
    return res.data;
  }

  async updateNote(
    id: string,
    noteId: string,
    content: string,
  ): Promise<ContactNote> {
    const res = await apiClient.patch<ApiDataResponse<ContactNote>>(
      `/contacts/${id}/notes/${encodeURIComponent(noteId)}`,
      { content },
    );
    return res.data;
  }

  async deleteNote(id: string, noteId: string): Promise<void> {
    await apiClient.delete(
      `/contacts/${id}/notes/${encodeURIComponent(noteId)}`,
    );
  }

  async addTag(id: string, tag: string): Promise<string> {
    const res = await apiClient.post<ApiDataResponse<{ tag: string }>>(
      `/contacts/${id}/tags`,
      { tag },
    );
    return res.data?.tag || tag;
  }

  async removeTag(id: string, tag: string): Promise<void> {
    await apiClient.delete(`/contacts/${id}/tags/${encodeURIComponent(tag)}`);
  }

  async getPendingConflicts(): Promise<ContactConflictItem[]> {
    const res = await apiClient.get<ConflictsResponse>("/contacts/conflicts");
    return res.data || [];
  }

  async resolveConflict(
    id: string,
    action: "apply" | "dismiss",
  ): Promise<void> {
    await apiClient.post(`/contacts/conflicts/${id}/resolve`, { action });
  }

  async updateContact(
    id: string,
    payload: ContactWritePayload,
  ): Promise<unknown> {
    const res = await apiClient.patch<ApiDataResponse<{ contact: unknown }>>(
      `/contacts/${id}`,
      payload,
    );
    return res.data;
  }
}

export const contactsApi = new ContactsApi();
