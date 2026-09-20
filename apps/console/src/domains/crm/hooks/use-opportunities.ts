import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { opportunitiesApi } from "../api/opportunities.api";
import type {
  CreateOpportunityPayload,
  OpportunityColor,
  OpportunityStage,
  UpdatePipelinePayload,
} from "../types/types";

export function useSalesPipeline() {
  return useQuery({
    queryKey: ["opportunities", "pipeline"],
    queryFn: opportunitiesApi.getPipeline,
  });
}

export function useOpportunities() {
  return useQuery({
    queryKey: ["opportunities"],
    queryFn: opportunitiesApi.list,
  });
}

export function useCreateOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOpportunityPayload) =>
      opportunitiesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useUpdateOpportunityStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: OpportunityStage }) =>
      opportunitiesApi.updateStage(id, stage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useUpdateOpportunityColor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, color }: { id: string; color: OpportunityColor }) =>
      opportunitiesApi.updateColor(id, color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });
}

export function useUpdateSalesPipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdatePipelinePayload) =>
      opportunitiesApi.updatePipeline(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({
        queryKey: ["opportunities", "pipeline"],
      });
      const previous = queryClient.getQueryData(["opportunities", "pipeline"]);
      queryClient.setQueryData(
        ["opportunities", "pipeline"],
        (current: { isDefault?: boolean } | undefined) => ({
          ...current,
          ...payload,
          isDefault: false,
        }),
      );
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["opportunities", "pipeline"],
          context.previous,
        );
      }
    },
    onSuccess: (pipeline) => {
      queryClient.setQueryData(["opportunities", "pipeline"], pipeline);
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });
}
