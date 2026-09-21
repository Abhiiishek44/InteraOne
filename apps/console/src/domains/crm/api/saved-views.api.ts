import { apiClient } from "@/shared/lib/api-client";
import type {
  CrmSavedView,
  SavedViewEntity,
  SavedViewState,
} from "../types/saved-view";

interface ViewsResponse {
  data: { views: CrmSavedView[] };
}

interface ViewResponse {
  data: { view: CrmSavedView };
}

export const savedViewsApi = {
  async list(entityType: SavedViewEntity): Promise<CrmSavedView[]> {
    const response = await apiClient.get<ViewsResponse>(
      `/crm/views?entityType=${entityType}`,
    );
    return response.data?.views || [];
  },

  async create(payload: {
    entityType: SavedViewEntity;
    name: string;
    state: SavedViewState;
  }): Promise<CrmSavedView> {
    const response = await apiClient.post<ViewResponse>("/crm/views", payload);
    return response.data.view;
  },

  async update(
    id: string,
    payload: { name?: string; state?: SavedViewState },
  ): Promise<CrmSavedView> {
    const response = await apiClient.patch<ViewResponse>(
      `/crm/views/${id}`,
      payload,
    );
    return response.data.view;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/crm/views/${id}`);
  },
};
