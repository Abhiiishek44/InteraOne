import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountsApi } from "../api/accounts.api";
import type {
  AccountActivityPayload,
  AccountWritePayload,
} from "../types/types";

export function useAccounts(
  search = "",
  limit = 100,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["accounts", search, limit],
    queryFn: () => accountsApi.list(search, limit),
    enabled: options?.enabled ?? true,
  });
}

export function useAccount(id?: string) {
  return useQuery({
    queryKey: ["accounts", "detail", id],
    queryFn: () => accountsApi.get(id!),
    enabled: Boolean(id),
  });
}

export function useCreateAccount() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: AccountWritePayload) => accountsApi.create(payload),
    onSuccess: () => client.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useUpdateAccount() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<AccountWritePayload>;
    }) => accountsApi.update(id, payload),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: ["accounts"] });
      client.invalidateQueries({
        queryKey: ["accounts", "detail", variables.id],
      });
      client.invalidateQueries({ queryKey: ["crm-records"] });
    },
  });
}

export function useAddAccountNote() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      accountsApi.addNote(id, content),
    onSuccess: (_data, variables) =>
      client.invalidateQueries({
        queryKey: ["accounts", "detail", variables.id],
      }),
  });
}

export function useAddAccountActivity() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: AccountActivityPayload;
    }) => accountsApi.addActivity(id, payload),
    onSuccess: (_data, variables) =>
      client.invalidateQueries({
        queryKey: ["accounts", "detail", variables.id],
      }),
  });
}

export function useUpdateAccountActivityStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      activityId,
      status,
    }: {
      id: string;
      activityId: string;
      status: "scheduled" | "done";
    }) => accountsApi.updateActivityStatus(id, activityId, status),
    onSuccess: (_data, variables) =>
      client.invalidateQueries({
        queryKey: ["accounts", "detail", variables.id],
      }),
  });
}
