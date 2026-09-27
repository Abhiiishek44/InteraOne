import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Eye,
  GripVertical,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { authApi } from "@/domains/auth/api/auth.api";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { FileUpload } from "@/shared/ui/file-upload";
import { storageApi } from "@/shared/lib/storage.api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useCrmFields, useCrmFieldMutations } from "../hooks/use-crm-fields";
import type {
  CrmFieldDefinition,
  CrmFieldEntity,
  CrmFieldType,
} from "../types/fields";

interface Props {
  entityType: CrmFieldEntity;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  systemFields?: Record<string, (field: CrmFieldDefinition) => ReactNode>;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
}

const blank = {
  label: "",
  type: "text" as CrmFieldType,
  required: false,
  visible: true,
  placeholder: "",
  defaultValue: "",
  options: "",
};

export function InlineCustomFields({
  entityType,
  values,
  onChange,
  systemFields = {},
  disabled,
  readOnly = false,
  className = "",
}: Props) {
  const { data: fields = [] } = useCrmFields(entityType);
  const mutations = useCrmFieldMutations(entityType);
  const [customizing, setCustomizing] = useState(false);
  const [editing, setEditing] = useState<CrmFieldDefinition | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [draft, setDraft] = useState(blank);
  const canCustomize = ["owner", "admin"].includes(authApi.getOrgRole() || "");
  const supportedFields = useMemo(
    () =>
      fields.filter(
        (field) => !field.isSystem || Boolean(systemFields[field.key]),
      ),
    [fields, systemFields],
  );
  const visibleFields = useMemo(
    () => supportedFields.filter((field) => field.visible),
    [supportedFields],
  );
  const hiddenFields = useMemo(
    () => supportedFields.filter((field) => !field.visible),
    [supportedFields],
  );

  useEffect(() => {
    if (!dialogOpen) {
      setEditing(null);
      setInsertAt(null);
      setDraft(blank);
    }
  }, [dialogOpen]);

  const openEdit = (field: CrmFieldDefinition) => {
    setEditing(field);
    setDraft({
      label: field.label,
      type: field.type,
      required: field.required,
      visible: field.visible,
      placeholder: field.placeholder,
      defaultValue:
        field.defaultValue == null ? "" : String(field.defaultValue),
      options: field.options.map((option) => option.label).join("\n"),
    });
    setDialogOpen(true);
  };

  const parsedDefault = () => {
    if (draft.defaultValue === "") return null;
    if (draft.type === "number") return Number(draft.defaultValue);
    if (draft.type === "boolean") return draft.defaultValue === "true";
    return draft.defaultValue;
  };

  const save = async () => {
    const options = draft.options
      .split("\n")
      .map((label) => label.trim())
      .filter(Boolean);
    if (!draft.label.trim()) return;
    try {
      if (editing) {
        await mutations.update.mutateAsync({
          id: editing.id,
          input: {
            label: draft.label,
            type: draft.type,
            required: draft.required,
            visible: draft.visible,
            placeholder: draft.placeholder,
            defaultValue: parsedDefault(),
            options: ["single_select", "multi_select"].includes(draft.type)
              ? options.map((label) => ({
                  id: editing.options.find((item) => item.label === label)?.id,
                  label,
                }))
              : [],
          },
        });
      } else {
        const created = await mutations.create.mutateAsync({
          entityType,
          label: draft.label,
          type: draft.type,
          required: draft.required,
          visible: true,
          defaultValue: parsedDefault(),
          placeholder: draft.placeholder,
          position: insertAt ?? fields.length,
          options: options.map((label) => ({ label })),
        });
        const ids = fields.map((field) => field.id);
        ids.splice(insertAt ?? ids.length, 0, created.id);
        await mutations.reorder.mutateAsync(ids);
      }
      setDialogOpen(false);
      toast.success(editing ? "Field updated" : "Field added");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save field",
      );
    }
  };

  const reorder = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const ids = fields.map((field) => field.id);
    const source = ids.indexOf(sourceId);
    const target = ids.indexOf(targetId);
    ids.splice(target, 0, ids.splice(source, 1)[0]);
    try {
      await mutations.reorder.mutateAsync(ids);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not reorder fields",
      );
    }
  };

  const remove = async (field: CrmFieldDefinition) => {
    if (
      !window.confirm(
        `Remove “${field.label}” from this form? Existing values will be preserved.`,
      )
    )
      return;
    try {
      await mutations.archive.mutateAsync(field.id);
      toast.success("Field removed");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not remove field",
      );
    }
  };

  const restore = async (field: CrmFieldDefinition) => {
    try {
      await mutations.update.mutateAsync({
        id: field.id,
        input: { visible: true },
      });
      toast.success("Field restored");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not restore field",
      );
    }
  };

  const setValue = (key: string, value: unknown) =>
    onChange({ ...values, [key]: value });
  const renderField = (field: CrmFieldDefinition) => {
    if (field.isSystem && systemFields[field.key])
      return systemFields[field.key](field);
    if (readOnly) {
      const value = values[field.key] ?? field.defaultValue;
      return (
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {field.label}
          </p>
          <p className="mt-1 break-words text-sm">
            {formatFieldValue(field, value)}
          </p>
        </div>
      );
    }
    return (
      <div className="grid gap-2">
        <Label htmlFor={`crm-field-${field.id}`}>
          {field.label}
          {field.required ? " *" : ""}
        </Label>
        <FieldInput
          field={field}
          value={values[field.key] ?? field.defaultValue}
          onChange={(value) => setValue(field.key, value)}
          disabled={disabled || customizing}
        />
      </div>
    );
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {canCustomize && !customizing && (
        <div className="flex justify-end border-b pb-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCustomizing(true)}
          >
            <Settings2 className="mr-2 h-4 w-4" />
            Customize form
          </Button>
        </div>
      )}
      {canCustomize && customizing && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/[0.05] px-4 py-3">
          <div>
            <p className="text-sm font-medium">Customize form layout</p>
            <p className="text-xs text-muted-foreground">
              Drag fields to reorder, or use the field actions to edit and remove.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setCustomizing(false)}
          >
            Done
          </Button>
        </div>
      )}
      {customizing && (
        <InsertField
          onClick={() => {
            setInsertAt(0);
            setDialogOpen(true);
          }}
        />
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {visibleFields.map((field, index) => (
          <div key={field.id} className="contents">
            <div
              draggable={customizing}
              onDragStart={() => setDraggedId(field.id)}
              onDragOver={(event) => customizing && event.preventDefault()}
              onDrop={() => {
                if (draggedId) void reorder(draggedId, field.id);
                setDraggedId(null);
              }}
              className={`${
                customizing
                  ? "relative rounded-lg border border-primary/30 bg-background p-3 pt-11 shadow-sm transition hover:border-primary/60"
                  : "min-w-0"
              } ${["file", "image", "signature"].includes(field.type) ? "md:col-span-2" : ""}`}
            >
              {customizing && (
                <div className="absolute inset-x-2 top-1.5 flex items-center justify-between">
                  <div className="flex cursor-grab items-center gap-1 text-xs text-muted-foreground">
                    <GripVertical className="h-4 w-4" />
                    Drag
                  </div>
                  <div className="flex rounded-md border bg-muted/30 p-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title={`Edit ${field.label}`}
                      onClick={() => openEdit(field)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      disabled={field.protected}
                      title={
                        field.protected
                          ? "Required system field"
                          : "Remove field"
                      }
                      onClick={() => void remove(field)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
              <div
                className={customizing ? "pointer-events-none opacity-70" : ""}
              >
                {renderField(field)}
              </div>
            </div>
            {customizing && index % 2 === 1 && (
              <div className="md:col-span-2">
                <InsertField
                  onClick={() => {
                    setInsertAt(index + 1);
                    setDialogOpen(true);
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      {customizing && (
        <>
          {visibleFields.length % 2 === 1 && (
            <InsertField
              onClick={() => {
                setInsertAt(visibleFields.length);
                setDialogOpen(true);
              }}
            />
          )}
          {hiddenFields.length > 0 && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Removed fields
              </p>
              <div className="flex flex-wrap gap-2">
                {hiddenFields.map((field) => (
                  <Button
                    key={field.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void restore(field)}
                  >
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    Restore {field.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Field properties" : "Add field"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Label</Label>
              <Input
                value={draft.label}
                onChange={(event) =>
                  setDraft({ ...draft, label: event.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Field type</Label>
              <Select
                disabled={Boolean(editing?.isSystem)}
                value={draft.type}
                onValueChange={(type) =>
                  setDraft({ ...draft, type: type as CrmFieldType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    ["text", "Text"],
                    ["number", "Number"],
                    ["date", "Date"],
                    ["boolean", "Checkbox"],
                    ["single_select", "Single select"],
                    ["multi_select", "Multi select"],
                    ["file", "File upload"],
                    ["image", "Image"],
                    ["signature", "Signature"],
                  ].map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Placeholder</Label>
              <Input
                value={draft.placeholder}
                onChange={(event) =>
                  setDraft({ ...draft, placeholder: event.target.value })
                }
              />
            </div>
            {!editing?.isSystem &&
              !["file", "image", "signature"].includes(draft.type) && (
              <div className="grid gap-2">
                <Label>Default value</Label>
                <Input
                  value={draft.defaultValue}
                  onChange={(event) =>
                    setDraft({ ...draft, defaultValue: event.target.value })
                  }
                />
              </div>
            )}
            {[editing?.type, draft.type].some(
              (type) => type === "single_select" || type === "multi_select",
            ) && (
                <div className="grid gap-2">
                  <Label>Options (one per line)</Label>
                  <textarea
                    className="min-h-28 rounded-md border bg-background px-3 py-2 text-sm"
                    value={draft.options}
                    onChange={(event) =>
                      setDraft({ ...draft, options: event.target.value })
                    }
                  />
                </div>
              )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.required}
                disabled={editing?.protected}
                onChange={(event) =>
                  setDraft({ ...draft, required: event.target.checked })
                }
              />
              Required
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.visible}
                disabled={editing?.protected}
                onChange={(event) =>
                  setDraft({ ...draft, visible: event.target.checked })
                }
              />
              Visible in form
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void save()}
              disabled={
                !draft.label.trim() ||
                mutations.create.isPending ||
                mutations.update.isPending
              }
            >
              Save field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatFieldValue(field: CrmFieldDefinition, value: unknown) {
  if (value === undefined || value === null || value === "") return "Not set";
  if (["file", "image", "signature"].includes(field.type)) {
    const asset = getUploadedAsset(value);
    if (!asset) return "Not set";
    const url = storageApi.getProxyFileUrl(asset.fileKey);
    if (field.type === "image" || field.type === "signature") {
      return (
        <a href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt={field.label}
            className={
              field.type === "signature"
                ? "max-h-24 max-w-full rounded-md border bg-white object-contain p-2"
                : "h-24 w-24 rounded-lg border object-cover"
            }
          />
        </a>
      );
    }
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-primary underline-offset-4 hover:underline"
      >
        {asset.fileName}
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
      field.options.find((option) => option.id === value)?.label || String(value)
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
}

function InsertField({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-2 py-1 text-xs text-muted-foreground opacity-70 transition hover:opacity-100"
    >
      <span className="h-px flex-1 bg-border group-hover:bg-primary" />
      <span className="flex items-center gap-1 rounded-full border bg-background px-2 py-1 group-hover:border-primary group-hover:text-primary">
        <Plus className="h-3 w-3" />
        Add field here
      </span>
      <span className="h-px flex-1 bg-border group-hover:bg-primary" />
    </button>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: CrmFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}) {
  if (["file", "image"].includes(field.type)) {
    const asset = getUploadedAsset(value);
    return (
      <FileUpload
        accept={field.type === "image" ? "image/*" : "*/*"}
        maxSize={field.type === "image" ? 5 * 1024 * 1024 : 10 * 1024 * 1024}
        disabled={disabled}
        buttonText={field.type === "image" ? "Choose image" : "Choose file"}
        helperText={
          field.type === "image"
            ? "PNG, JPG or WebP up to 5 MB"
            : "Maximum file size: 10 MB"
        }
        initialPreview={
          asset ? storageApi.getProxyFileUrl(asset.fileKey) : undefined
        }
        initialFileName={asset?.fileName}
        onUploadSuccess={({ fileKey, fileName }) =>
          onChange({ fileKey, fileName, mimeType: field.type === "image" ? "image/*" : "application/octet-stream" })
        }
        onRemove={() => onChange(null)}
      />
    );
  }
  if (field.type === "signature") {
    return (
      <SignatureInput
        value={getUploadedAsset(value)}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }
  if (field.type === "boolean")
    return (
      <label className="flex h-9 items-center gap-2 text-sm">
        <input
          id={`crm-field-${field.id}`}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
        />
        Yes
      </label>
    );
  if (field.type === "single_select")
    return (
      <Select
        value={typeof value === "string" && value ? value : "unset"}
        onValueChange={(next) => onChange(next === "unset" ? null : next)}
        disabled={disabled}
      >
        <SelectTrigger id={`crm-field-${field.id}`}>
          <SelectValue placeholder={field.placeholder || "Select an option"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unset">Not set</SelectItem>
          {field.options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  if (field.type === "multi_select")
    return (
      <div className="flex flex-wrap gap-2">
        {field.options.map((option) => {
          const selected = Array.isArray(value) && value.includes(option.id);
          return (
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant={selected ? "default" : "outline"}
              disabled={disabled}
              onClick={() =>
                onChange(
                  selected
                    ? (value as unknown[]).filter((item) => item !== option.id)
                    : [...(Array.isArray(value) ? value : []), option.id],
                )
              }
            >
              {option.label}
            </Button>
          );
        })}
      </div>
    );
  return (
    <Input
      id={`crm-field-${field.id}`}
      type={
        field.type === "number"
          ? "number"
          : field.type === "date"
            ? "date"
            : "text"
      }
      value={
        typeof value === "string" || typeof value === "number" ? value : ""
      }
      placeholder={field.placeholder}
      required={field.required}
      disabled={disabled}
      onChange={(event) =>
        onChange(
          field.type === "number"
            ? event.target.value === ""
              ? null
              : Number(event.target.value)
            : event.target.value,
        )
      }
    />
  );
}

interface UploadedAssetValue {
  fileKey: string;
  fileName: string;
  mimeType?: string;
}

function getUploadedAsset(value: unknown): UploadedAssetValue | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const asset = value as Record<string, unknown>;
  if (typeof asset.fileKey !== "string" || typeof asset.fileName !== "string")
    return null;
  return {
    fileKey: asset.fileKey,
    fileName: asset.fileName,
    mimeType: typeof asset.mimeType === "string" ? asset.mimeType : undefined,
  };
}

function SignatureInput({
  value,
  onChange,
  disabled,
}: {
  value: UploadedAssetValue | null;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const point = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  };
  const start = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const next = point(event);
    context.beginPath();
    context.moveTo(next.x, next.y);
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.strokeStyle = "#111827";
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrawing(true);
  };
  const draw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const next = point(event);
    context.lineTo(next.x, next.y);
    context.stroke();
  };
  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };
  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setUploading(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error("Could not create signature"))),
          "image/png",
        ),
      );
      const file = new File([blob], `signature-${Date.now()}.png`, {
        type: "image/png",
      });
      const response = await storageApi.generatePresignedUploadUrl(
        file.name,
        file.type,
        3600,
      );
      await storageApi.uploadFileWithPresignedUrl(response.data.uploadUrl, file);
      onChange({
        fileKey: response.data.fileKey,
        fileName: file.name,
        mimeType: file.type,
      });
      toast.success("Signature saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save signature");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {value && (
        <img
          src={storageApi.getProxyFileUrl(value.fileKey)}
          alt="Saved signature"
          className="max-h-20 rounded-md border bg-white p-2"
        />
      )}
      <canvas
        ref={canvasRef}
        width={600}
        height={180}
        className="h-32 w-full touch-none rounded-md border bg-white"
        onPointerDown={start}
        onPointerMove={draw}
        onPointerUp={() => setDrawing(false)}
        onPointerCancel={() => setDrawing(false)}
      />
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => void save()} disabled={disabled || uploading}>
          {uploading ? "Saving…" : "Save signature"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={clear} disabled={disabled || uploading}>
          Clear
        </Button>
      </div>
    </div>
  );
}
