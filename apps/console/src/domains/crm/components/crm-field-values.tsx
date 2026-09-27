import { useCrmFields } from "../hooks/use-crm-fields";
import type { CrmFieldDefinition, CrmFieldEntity } from "../types/fields";
import { Card, CardContent } from "@/shared/ui/card";
import { storageApi } from "@/shared/lib/storage.api";

interface Props {
  entityType: CrmFieldEntity;
  values?: Record<string, unknown>;
  title?: string;
}

const formatValue = (field: CrmFieldDefinition, value: unknown) => {
  if (value === undefined || value === null || value === "") return "Not set";
  if (["file", "image", "signature"].includes(field.type)) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return "Not set";
    const asset = value as Record<string, unknown>;
    if (typeof asset.fileKey !== "string") return "Not set";
    const url = storageApi.getProxyFileUrl(asset.fileKey);
    if (field.type === "image" || field.type === "signature") {
      return (
        <a href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt={field.label}
            className={
              field.type === "signature"
                ? "max-h-24 rounded-md border bg-white object-contain p-2"
                : "h-24 w-24 rounded-lg border object-cover"
            }
          />
        </a>
      );
    }
    return (
      <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
        {typeof asset.fileName === "string" ? asset.fileName : "Download file"}
      </a>
    );
  }
  if (field.type === "boolean") return value ? "Yes" : "No";
  if (field.type === "date") {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleDateString();
  }
  if (field.type === "single_select") {
    return (
      field.options.find((option) => option.id === value)?.label ||
      String(value)
    );
  }
  if (field.type === "multi_select" && Array.isArray(value)) {
    return value
      .map(
        (item) =>
          field.options.find((option) => option.id === item)?.label ||
          String(item),
      )
      .join(", ");
  }
  return String(value);
};

export function CrmFieldValues({ entityType, values = {}, title }: Props) {
  const { data: fields = [] } = useCrmFields(entityType);
  const customFields = fields.filter(
    (field) => !field.isSystem && field.visible,
  );

  if (customFields.length === 0) return null;

  const content = (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {customFields.map((field) => (
        <div key={field.id} className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {field.label}
          </p>
          <p className="mt-1 break-words text-sm">
            {formatValue(field, values[field.key] ?? field.defaultValue)}
          </p>
        </div>
      ))}
    </div>
  );

  if (!title) return content;
  return (
    <Card>
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
      </div>
      <CardContent className="p-5">{content}</CardContent>
    </Card>
  );
}
