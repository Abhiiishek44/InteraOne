import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountsApi } from "../api/accounts.api";
import type { AccountWritePayload } from "../types/types";

export function useAccounts(search = "", limit = 100) {
  return useQuery({ queryKey: ["accounts", search, limit], queryFn: () => accountsApi.list(search, limit) });
}

export function useAccount(id?: string) {
  return useQuery({ queryKey: ["accounts", "detail", id], queryFn: () => accountsApi.get(id!), enabled: Boolean(id) });
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
    mutationFn: ({ id, payload }: { id: string; payload: Partial<AccountWritePayload> }) => accountsApi.update(id, payload),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: ["accounts"] });
      client.invalidateQueries({ queryKey: ["accounts", "detail", variables.id] });
    },
  });
}

export function useAddAccountNote() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => accountsApi.addNote(id, content),
    onSuccess: (_data, variables) => client.invalidateQueries({ queryKey: ["accounts", "detail", variables.id] }),
  });
}
