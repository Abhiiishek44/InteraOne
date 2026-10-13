import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { crmRecordsApi } from "../api/crm-records.api";
import type {
  CreateCrmRecordPayload,
  CrmRecordColor,
  CrmRecordStage,
  UpdatePipelinePayload,
  UpdateCrmRecordPayload,
} from "../types/types";

export function useSalesPipeline() {
  return useQuery({
    queryKey: ["crm-records", "pipeline"],
    queryFn: crmRecordsApi.getPipeline,
  });
}

export function useCrmRecords() {
  return useQuery({
    queryKey: ["crm-records"],
    queryFn: () => crmRecordsApi.list("deal"),
  });
}

export function useLeads() {
  return useQuery({
    queryKey: ["crm-records", "leads"],
    queryFn: () => crmRecordsApi.list("lead"),
  });
}

export function useCreateCrmRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCrmRecordPayload) =>
      crmRecordsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-records"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useConvertLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => crmRecordsApi.convertLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-records"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useUpdateCrmRecord(recordType: "lead" | "deal" = "deal") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateCrmRecordPayload & { id: string }) =>
      crmRecordsApi.update(id, payload, recordType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-records"] });
    },
  });
}

export function useDeleteCrmRecord(recordType: "lead" | "deal" = "deal") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => crmRecordsApi.remove(id, recordType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-records"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useUpdateCrmRecordStage(recordType: "lead" | "deal" = "deal") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: CrmRecordStage }) =>
      crmRecordsApi.updateStage(id, stage, recordType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-records"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useUpdateCrmRecordColor(recordType: "lead" | "deal" = "deal") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, color }: { id: string; color: CrmRecordColor }) =>
      crmRecordsApi.updateColor(id, color, recordType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-records"] });
    },
  });
}

export function useMoveCrmRecord(recordType: "lead" | "deal" = "deal") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      stage,
      position,
    }: {
      id: string;
      stage: CrmRecordStage;
      position: number;
    }) => crmRecordsApi.move(id, stage, position, recordType),
    onMutate: async ({ id, stage, position }) => {
      await queryClient.cancelQueries({
        queryKey: ["crm-records"],
        exact: true,
      });
      const previous = queryClient.getQueryData<
        import("../types/types").CrmRecord[]
      >(["crm-records"]);
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
        ["crm-records"],
        withoutMoving
          .filter((item) => item.stage !== stage)
          .concat(targetItems.map((item) => targetMap.get(item.id)!)),
      );
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["crm-records"], context.previous);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["crm-records"],
        exact: true,
      });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useUpdateCrmRecordNextAction(
  recordType: "lead" | "deal" = "deal",
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nextAction }: { id: string; nextAction: string }) =>
      crmRecordsApi.updateNextAction(id, nextAction, recordType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-records"] });
    },
  });
}

export function useAddCrmRecordActivity(recordType: "lead" | "deal" = "deal") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      content,
      dueAt,
      category,
      customFields,
      durationMinutes,
    }: {
      id: string;
      content: string;
      dueAt?: string;
      category?: "todo" | "email" | "call" | "meeting" | "document";
      customFields?: Record<string, unknown>;
      durationMinutes?: number;
    }) =>
      crmRecordsApi.addActivity(
        id,
        content,
        dueAt,
        category,
        customFields,
        durationMinutes,
        recordType,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-records"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useUpdateCrmRecordPriority(
  recordType: "lead" | "deal" = "deal",
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: 1 | 2 | 3 }) =>
      crmRecordsApi.updatePriority(id, priority, recordType),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["crm-records"] }),
  });
}

export function useCompleteCrmRecordActivity(
  recordType: "lead" | "deal" = "deal",
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activityId }: { id: string; activityId: string }) =>
      crmRecordsApi.completeActivity(id, activityId, recordType),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["crm-records"] }),
  });
}

export function useUpdateCrmRecordActivity(
  recordType: "lead" | "deal" = "deal",
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      activityId,
      payload,
    }: {
      id: string;
      activityId: string;
      payload: {
        content?: string;
        dueAt?: string | null;
        durationMinutes?: number;
        category?: "todo" | "email" | "call" | "meeting" | "document";
        customFields?: Record<string, unknown>;
      };
    }) => crmRecordsApi.updateActivity(id, activityId, payload, recordType),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["crm-records"] }),
  });
}

export function useDeleteCrmRecordActivity(
  recordType: "lead" | "deal" = "deal",
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activityId }: { id: string; activityId: string }) =>
      crmRecordsApi.deleteActivity(id, activityId, recordType),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["crm-records"] }),
  });
}

// Backward-compatible note helpers used by the deal workspace.
export function useUpdateCrmRecordNote(recordType: "lead" | "deal" = "deal") {
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
    }) => crmRecordsApi.updateNote(id, activityId, content, recordType),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["crm-records"] }),
  });
}

export function useDeleteCrmRecordNote(recordType: "lead" | "deal" = "deal") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activityId }: { id: string; activityId: string }) =>
      crmRecordsApi.deleteNote(id, activityId, recordType),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["crm-records"] }),
  });
}

export function useUpdateSalesPipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdatePipelinePayload) =>
      crmRecordsApi.updatePipeline(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({
        queryKey: ["crm-records", "pipeline"],
      });
      const previous = queryClient.getQueryData(["crm-records", "pipeline"]);
      queryClient.setQueryData(
        ["crm-records", "pipeline"],
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
        queryClient.setQueryData(["crm-records", "pipeline"], context.previous);
      }
    },
    onSuccess: (pipeline) => {
      queryClient.setQueryData(["crm-records", "pipeline"], pipeline);
      queryClient.invalidateQueries({ queryKey: ["crm-records"] });
    },
  });
}
