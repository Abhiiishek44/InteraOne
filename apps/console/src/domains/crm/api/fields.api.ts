import { apiClient } from "@/shared/lib/api-client";
import type {
  CrmFieldDefinition,
  CrmFieldEntity,
  CrmFieldInput,
} from "../types/fields";

type FieldsResponse = { data: { fields: CrmFieldDefinition[] } };
type FieldResponse = { data: { field: CrmFieldDefinition } };

export const crmFieldsApi = {
  async list(entityType: CrmFieldEntity) {
    const response = await apiClient.get<FieldsResponse>(
      `/crm/fields?entityType=${entityType}`,
    );
    return response.data.fields;
  },
  async create(input: CrmFieldInput) {
    const response = await apiClient.post<FieldResponse>("/crm/fields", input);
    return response.data.field;
  },
  async update(id: string, input: Partial<Omit<CrmFieldInput, "entityType">>) {
    const response = await apiClient.patch<FieldResponse>(
      `/crm/fields/${id}`,
      input,
    );
    return response.data.field;
  },
  async archive(id: string) {
    await apiClient.delete(`/crm/fields/${id}`);
  },
  async reorder(entityType: CrmFieldEntity, fieldIds: string[]) {
    const response = await apiClient.patch<FieldsResponse>(
      "/crm/fields/reorder",
      { entityType, fieldIds },
    );
    return response.data.fields;
  },
};
