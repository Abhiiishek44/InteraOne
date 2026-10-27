import { useRef, useState } from "react";
import { FileText, Loader2, Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";
import { storageApi } from "@/shared/lib/storage.api";
import { Button } from "@/shared/ui/button";
import { useAddCrmRecordActivity } from "../hooks/use-crm-records";
import type { CrmRecord } from "../types/types";

type DealActivity = CrmRecord["activities"][number];

const attachmentKind = (activity: DealActivity) => {
  const value = activity.customFields?.attachmentKind;
  return value === "file" || value === "document" ? value : null;
};

const attachmentValue = (activity: DealActivity, key: string) => {
  const value = activity.customFields?.[key];
  return typeof value === "string" ? value : "";
};

export function DealFileWorkspace({
  deal,
  documentMode = false,
}: {
  deal: CrmRecord;
  documentMode?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const addActivity = useAddCrmRecordActivity();
  const kind = documentMode ? "document" : "file";
  const items = deal.activities.filter(
    (activity) => attachmentKind(activity) === kind,
  );

  const uploadFiles = async (files: FileList | File[]) => {
    const selected = Array.from(files);
    if (!selected.length) return;
    setUploading(true);
    try {
      for (const file of selected) {
        const { data: upload } = await storageApi.generatePresignedUploadUrl(
          file.name,
          file.type || "application/octet-stream",
          3600,
        );
        await storageApi.uploadFileWithPresignedUrl(upload.uploadUrl, file);
        try {
          await addActivity.mutateAsync({
            id: deal.id,
            content: file.name,
            category: "document",
            customFields: {
              attachmentKind: kind,
              fileName: file.name,
              fileKey: upload.fileKey,
              mimeType: file.type || "application/octet-stream",
              size: file.size,
              description: "",
            },
          });
        } catch (error) {
          await storageApi.deleteStorageFile(upload.fileKey).catch(() => {});
          throw error;
        }
      }
      toast.success(
        `${selected.length} ${kind}${selected.length === 1 ? "" : "s"} uploaded`,
      );
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept={
          documentMode
            ? ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            : ".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.csv,.zip"
        }
        onChange={(event) => {
          if (event.target.files) void uploadFiles(event.target.files);
        }}
      />
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void uploadFiles(event.dataTransfer.files);
        }}
        className={`flex min-h-28 flex-wrap items-center justify-center rounded-md border-2 border-dashed p-5 transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border bg-muted/20"}`}
      >
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Upload {documentMode ? "documents" : "files"}
        </Button>
        <span className="ml-2 text-sm text-muted-foreground">
          or drag them here.
        </span>
      </div>
      {items.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {items.map((item) => {
            const fileKey = attachmentValue(item, "fileKey");
            const fileName = attachmentValue(item, "fileName") || item.content;
            const size = item.customFields?.size;
            return (
              <a
                key={item.id}
                href={fileKey ? storageApi.getProxyFileUrl(fileKey) : undefined}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-md border border-border p-3 hover:bg-muted"
              >
                {documentMode ? (
                  <FileText className="h-4 w-4 text-primary" />
                ) : (
                  <Paperclip className="h-4 w-4 text-primary" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {fileName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {typeof size === "number"
                      ? `${Math.max(1, Math.ceil(size / 1024))} KB`
                      : documentMode
                        ? "Document"
                        : "File"}
                  </span>
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
