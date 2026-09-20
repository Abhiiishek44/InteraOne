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
  };
}

interface ConflictsResponse {
  success: boolean;
  message: string;
  data: ContactConflictItem[];
}

class ContactsApi {
  async getContacts(): Promise<ContactListItem[]> {
    const response = await apiClient.get<ContactsResponse>("/contacts");
    return response.data?.contacts || [];
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
