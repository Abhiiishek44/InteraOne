import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { savedViewsApi } from "../api/saved-views.api";
import type { SavedViewEntity, SavedViewState } from "../types/saved-view";

const viewKey = (entityType: SavedViewEntity) => [
  "crm-saved-views",
  entityType,
];

export function useSavedViews(entityType: SavedViewEntity) {
  return useQuery({
    queryKey: viewKey(entityType),
    queryFn: () => savedViewsApi.list(entityType),
  });
}

export function useCreateSavedView(entityType: SavedViewEntity) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, state }: { name: string; state: SavedViewState }) =>
      savedViewsApi.create({ entityType, name, state }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: viewKey(entityType) }),
  });
}

export function useUpdateSavedView(entityType: SavedViewEntity) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      name,
      state,
    }: {
      id: string;
      name?: string;
      state?: SavedViewState;
    }) => savedViewsApi.update(id, { name, state }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: viewKey(entityType) }),
  });
}

export function useDeleteSavedView(entityType: SavedViewEntity) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => savedViewsApi.remove(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: viewKey(entityType) }),
  });
}
