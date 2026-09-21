import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { opportunitiesApi } from "../api/opportunities.api";
import type {
  CreateOpportunityPayload,
  OpportunityColor,
  OpportunityStage,
  UpdatePipelinePayload,
  UpdateOpportunityPayload,
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

export function useUpdateOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: UpdateOpportunityPayload & { id: string }) =>
      opportunitiesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });
}

export function useDeleteOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => opportunitiesApi.remove(id),
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

export function useMoveOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      stage,
      position,
    }: {
      id: string;
      stage: OpportunityStage;
      position: number;
    }) => opportunitiesApi.move(id, stage, position),
    onMutate: async ({ id, stage, position }) => {
      await queryClient.cancelQueries({
        queryKey: ["opportunities"],
        exact: true,
      });
      const previous = queryClient.getQueryData<
        import("../types/types").Opportunity[]
      >(["opportunities"]);
      if (!previous) return { previous };
      const moving = previous.find((item) => item.id === id);
      if (!moving) return { previous };
      const withoutMoving = previous.filter((item) => item.id !== id);
      const targetItems = withoutMoving
        .filter((item) => item.stage === stage)
        .sort((a, b) => a.position - b.position);
      targetItems.splice(Math.min(position, targetItems.length), 0, {
        ...moving,
        stage,
      });
      const targetMap = new Map(
        targetItems.map((item, index) => [
          item.id,
          { ...item, position: index },
        ]),
      );
      queryClient.setQueryData(
        ["opportunities"],
        withoutMoving
          .filter((item) => item.stage !== stage)
          .concat(targetItems.map((item) => targetMap.get(item.id)!)),
      );
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["opportunities"], context.previous);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["opportunities"],
        exact: true,
      });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useUpdateOpportunityNextAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nextAction }: { id: string; nextAction: string }) =>
      opportunitiesApi.updateNextAction(id, nextAction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });
}

export function useAddOpportunityActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      content,
      dueAt,
      category,
    }: {
      id: string;
      content: string;
      dueAt?: string;
      category?: "todo" | "email" | "call" | "meeting" | "document";
    }) => opportunitiesApi.addActivity(id, content, dueAt, category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useUpdateOpportunityPriority() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: 1 | 2 | 3 }) =>
      opportunitiesApi.updatePriority(id, priority),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
  });
}

export function useCompleteOpportunityActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activityId }: { id: string; activityId: string }) =>
      opportunitiesApi.completeActivity(id, activityId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
  });
}

export function useUpdateOpportunityNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      activityId,
      content,
    }: {
      id: string;
      activityId: string;
      content: string;
    }) => opportunitiesApi.updateNote(id, activityId, content),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
  });
}

export function useDeleteOpportunityNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activityId }: { id: string; activityId: string }) =>
      opportunitiesApi.deleteNote(id, activityId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
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
