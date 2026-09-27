export type CrmFieldEntity =
  | "contacts"
  | "accounts"
  | "opportunities"
  | "activities";
export type CrmFieldType =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "single_select"
  | "multi_select"
  | "file"
  | "image"
  | "signature";

export interface CrmFieldDefinition {
  id: string;
  entityType: CrmFieldEntity;
  key: string;
  label: string;
  type: CrmFieldType;
  isSystem: boolean;
  protected: boolean;
  required: boolean;
  visible: boolean;
  defaultValue: unknown;
  placeholder: string;
  position: number;
  options: Array<{ id: string; label: string }>;
}

export interface CrmFieldInput {
  entityType: CrmFieldEntity;
  label: string;
  type: CrmFieldType;
  required?: boolean;
  visible?: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  position?: number;
  options?: Array<{ id?: string; label: string }>;
}
