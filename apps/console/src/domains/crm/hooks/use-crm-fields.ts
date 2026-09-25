import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { crmFieldsApi } from "../api/fields.api";
import type { CrmFieldEntity, CrmFieldInput } from "../types/fields";

const key = (entityType: CrmFieldEntity) => ["crm-fields", entityType];

export const useCrmFields = (entityType: CrmFieldEntity) =>
  useQuery({
    queryKey: key(entityType),
    queryFn: () => crmFieldsApi.list(entityType),
  });

export function useCrmFieldMutations(entityType: CrmFieldEntity) {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: key(entityType) });
  return {
    create: useMutation({
      mutationFn: (input: CrmFieldInput) => crmFieldsApi.create(input),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        input,
      }: {  
        id: string;
        input: Partial<Omit<CrmFieldInput, "entityType">>;
      }) => crmFieldsApi.update(id, input),
      onSuccess: refresh,
    }),
    archive: useMutation({
      mutationFn: (id: string) => crmFieldsApi.archive(id),
      onSuccess: refresh,
    }),
    reorder: useMutation({
      mutationFn: (fieldIds: string[]) =>
        crmFieldsApi.reorder(entityType, fieldIds),
      onSuccess: refresh,
    }),
  };
}
