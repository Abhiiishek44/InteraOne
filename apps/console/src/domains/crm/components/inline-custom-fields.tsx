import type { ReactNode } from "react";
import type { CrmFieldDefinition, CrmFieldEntity } from "../types/fields";

interface Props {
  entityType: CrmFieldEntity;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  systemFields?: Record<string, (field: CrmFieldDefinition) => ReactNode>;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  customizing?: boolean;
  onCustomizingChange?: (customizing: boolean) => void;
  showCustomizeButton?: boolean;
  alwaysShowRequired?: boolean;
  alwaysShowFieldKeys?: string[];
  excludeFieldKeys?: string[];
}

const FIELD_META: Record<string, Partial<CrmFieldDefinition>> = {
  name: { label: "Name", required: true, placeholder: "Enter name" },
  company: { label: "Organization", placeholder: "Select an organization" },
  phone: { label: "Phone", placeholder: "Phone number" },
  email: { label: "Email", placeholder: "Email address" },
  tags: { label: "Labels" },
  ownerId: { label: "Owner" },
  lifecycleStage: { label: "Lifecycle stage" },
  leadStatus: { label: "Lead status" },
  acquisitionSource: { label: "Acquisition source" },
  preferredChannel: { label: "Preferred channel" },
  nextFollowUpAt: { label: "Next follow-up" },
  category: { label: "Activity type", required: true },
  content: {
    label: "Activity",
    required: true,
    placeholder: "Add activity details",
  },
  notes: { label: "Notes", placeholder: "Add notes" },
  expectedCloseAt: { label: "Expected close date" },
};

export function InlineCustomFields({
  entityType,
  systemFields = {},
  className = "",
  excludeFieldKeys = [],
}: Props) {
  const entries = Object.entries(systemFields).filter(
    ([key]) => !excludeFieldKeys.includes(key),
  );
  if (!entries.length) return null;

  return (
    <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${className}`}>
      {entries.map(([key, render]) => {
        const meta = FIELD_META[key] || {};
        const field: CrmFieldDefinition = {
          id: `fixed-${entityType}-${key}`,
          entityType,
          key,
          label: meta.label || key.replace(/([a-z])([A-Z])/g, "$1 $2"),
          type: meta.type || "text",
          isSystem: true,
          protected: true,
          required: Boolean(meta.required),
          visible: true,
          defaultValue: null,
          placeholder: meta.placeholder || "",
          position: 0,
          options: meta.options || [],
        };
        return <div key={key}>{render(field)}</div>;
      })}
    </div>
  );
}
