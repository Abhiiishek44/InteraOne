import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { contactsApi } from "../api/contacts.api";
import type { ContactListQuery } from "../api/contacts.api";
import type {
  ContactListItem,
  ContactConflictItem,
  ContactWritePayload,
} from "../types/types";

export function useContacts() {
  return useQuery<ContactListItem[], Error>({
    queryKey: ["contacts"],
    queryFn: () => contactsApi.getContacts(),
    placeholderData: (previousContacts) => previousContacts,
  });
}

export function useContactsPage(
  query: ContactListQuery,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["contacts", "page", query],
    queryFn: () => contactsApi.getContactsPage(query),
    placeholderData: (previousPage) => previousPage,
    enabled: options?.enabled ?? true,
  });
}

export function useContactOwners() {
  return useQuery({
    queryKey: ["contacts", "owners"],
    queryFn: () => contactsApi.getContactOwners(),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePendingConflicts() {
  return useQuery<ContactConflictItem[], Error>({
    queryKey: ["contacts", "conflicts"],
    queryFn: () => contactsApi.getPendingConflicts(),
  });
}

export function useResolveConflict() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      conflictId,
      action,
    }: {
      conflictId: string;
      action: "apply" | "dismiss";
    }) => contactsApi.resolveConflict(conflictId, action),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts", "conflicts"] });
    },
  });
}

export function useDeleteContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => contactsApi.deleteContacts(ids),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ContactWritePayload & { name: string }) =>
      contactsApi.createContact(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useBulkAddTags() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, tags }: { ids: string[]; tags: string[] }) =>
      contactsApi.bulkAddTags(ids, tags),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: ContactWritePayload & { id: string }) =>
      contactsApi.updateContact(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["conversation"] });
    },
  });
}
