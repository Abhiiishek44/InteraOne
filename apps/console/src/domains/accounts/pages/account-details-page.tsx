import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import {
  AtSign,
  Bold,
  Building2,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Flag,
  Image,
  Italic,
  Link as LinkIcon,
  List,
  Loader2,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Pin,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  Tag,
  Trash2,
  Underline,
  Upload,
  UserRound,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAccount,
  useAddAccountActivity,
  useAddAccountNote,
  useUpdateAccount,
  useUpdateAccountActivityStatus,
} from "../hooks/use-accounts";
import type {
  AccountActivityPayload,
  AccountDetail,
  AccountWritePayload,
} from "../types/types";
import { accountsApi } from "../api/accounts.api";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Loader } from "@/shared/ui/loader";
import { storageApi } from "@/shared/lib/storage.api";
import {
  ActivityWorkspaceComposer,
  ActivityWorkspaceEmpty,
  ActivityWorkspaceHistoryCard,
  ActivityWorkspaceHistoryFilters,
  ActivityWorkspaceSectionHeader,
  type ActivityWorkspaceTab,
} from "@/domains/crm/components/activity-workspace-ui";

type OrganizationHistoryFilter =
  | "all"
  | "activities"
  | "notes"
  | "whatsapp"
  | "emails"
  | "files"
  | "documents"
  | "leads"
  | "deals"
  | "changelog";

type DealLinkFilter = "all" | "direct" | "fields" | "participants";

function formatDealMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

const ORGANIZATION_LABEL_SWATCHES = [
  { id: "blue", dot: "bg-blue-500", badge: "bg-blue-600 text-white" },
  {
    id: "mint",
    dot: "bg-emerald-300",
    badge: "bg-emerald-300 text-emerald-950",
  },
  {
    id: "yellow",
    dot: "bg-yellow-400",
    badge: "bg-yellow-300 text-yellow-950",
  },
  { id: "red", dot: "bg-red-500", badge: "bg-red-500 text-white" },
  { id: "purple", dot: "bg-fuchsia-600", badge: "bg-fuchsia-600 text-white" },
  { id: "gray", dot: "bg-gray-300", badge: "bg-gray-300 text-gray-900" },
  { id: "brown", dot: "bg-amber-700", badge: "bg-amber-700 text-white" },
  {
    id: "orange",
    dot: "bg-orange-400",
    badge: "bg-orange-400 text-orange-950",
  },
  { id: "slate", dot: "bg-slate-500", badge: "bg-slate-500 text-white" },
  { id: "pink", dot: "bg-pink-400", badge: "bg-pink-400 text-pink-950" },
] as const;

function sanitizeOrganizationHtml(value: string) {
  if (typeof document === "undefined") return value;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = value;
  const allowed = new Set([
    "B",
    "STRONG",
    "I",
    "EM",
    "U",
    "A",
    "UL",
    "OL",
    "LI",
    "BR",
    "P",
    "DIV",
    "IMG",
  ]);
  wrapper.querySelectorAll("*").forEach((element) => {
    if (!allowed.has(element.tagName)) {
      element.replaceWith(document.createTextNode(element.textContent || ""));
      return;
    }
    const href =
      element instanceof HTMLAnchorElement
        ? element.getAttribute("href") || ""
        : "";
    const src =
      element instanceof HTMLImageElement
        ? element.getAttribute("src") || ""
        : "";
    Array.from(element.attributes).forEach((attribute) =>
      element.removeAttribute(attribute.name),
    );
    if (element instanceof HTMLAnchorElement && /^https?:\/\//i.test(href)) {
      element.href = href;
      element.target = "_blank";
      element.rel = "noreferrer noopener";
    }
    if (element instanceof HTMLImageElement) {
      if (/^https?:\/\//i.test(src)) {
        element.src = src;
        element.alt = "Note attachment";
      } else element.remove();
    }
  });
  return wrapper.innerHTML;
}

function organizationText(value: string) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = sanitizeOrganizationHtml(value);
  return (wrapper.textContent || "").trim();
}

function EditableOrganizationField({
  label,
  value,
  type = "text",
  onSave,
  fieldId,
}: {
  label: string;
  value: string;
  type?: "text" | "url" | "number";
  onSave: (value: string) => Promise<void>;
  fieldId?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="group grid min-h-11 grid-cols-[118px_minmax(0,1fr)] items-center border-b border-border/60 px-3 py-1 last:border-0">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1 py-1">
          <Input
            autoFocus
            type={type}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void save();
              if (event.key === "Escape") setEditing(false);
            }}
            className="h-8"
          />
          <Button size="xs" onClick={() => void save()} disabled={saving}>
            {saving ? "…" : "Save"}
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => setEditing(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <button
          id={fieldId}
          type="button"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          className="flex min-h-9 items-center justify-between gap-2 rounded px-2 text-left text-sm hover:bg-muted/40"
        >
          <span className={value ? "break-words" : "text-muted-foreground"}>
            {value || "—"}
          </span>
          <Pencil className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100" />
        </button>
      )}
    </div>
  );
}

function OrganizationActivityComposer({
  organizationId,
  onClose,
  activity,
}: {
  organizationId: string;
  onClose: () => void;
  activity?: AccountDetail["activity"][number];
}) {
  const addActivity = useAddAccountActivity();
  const queryClient = useQueryClient();
  const descriptionRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef(0);
  const [timelineInteraction, setTimelineInteraction] = useState<
    "move" | "resize-start" | "resize-end" | null
  >(null);
  const now = new Date();
  now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
  const initialTimelineHourRef = useRef(
    activity?.startAt ? new Date(activity.startAt).getHours() : now.getHours(),
  );
  const later = new Date(now.getTime() + 60 * 60 * 1000);
  const local = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const [title, setTitle] = useState(activity?.title || "Meeting");
  const [activityType, setActivityType] = useState<
    AccountActivityPayload["activityType"]
  >(activity?.activityType || "meeting");
  const [startAt, setStartAt] = useState(
    local(activity?.startAt ? new Date(activity.startAt) : now),
  );
  const [endAt, setEndAt] = useState(
    local(activity?.endAt ? new Date(activity.endAt) : later),
  );
  const [priority, setPriority] = useState<AccountActivityPayload["priority"]>(
    activity?.priority || "none",
  );
  const [description, setDescription] = useState(activity?.content || "");
  const activityTypes = [
    { id: "call" as const, label: "Call", icon: Phone },
    { id: "meeting" as const, label: "Meeting", icon: Users },
    { id: "task" as const, label: "Task", icon: CheckSquare },
    { id: "deadline" as const, label: "Deadline", icon: Flag },
    { id: "lunch" as const, label: "Lunch", icon: Utensils },
  ];
  const save = async () => {
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (!title.trim() || end <= start)
      return toast.error("Enter a title and valid time range");
    try {
      const payload: AccountActivityPayload = {
        title: title.trim(),
        content: sanitizeOrganizationHtml(
          descriptionRef.current?.innerHTML || description,
        ),
        activityType,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        priority,
        status: activity?.status || "scheduled",
      };
      if (activity) {
        await accountsApi.updateActivity(organizationId, activity.id, payload);
        await queryClient.invalidateQueries({
          queryKey: ["accounts", "detail", organizationId],
        });
      } else {
        await addActivity.mutateAsync({ id: organizationId, payload });
      }
      toast.success(activity ? "Activity updated" : "Activity scheduled");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to schedule activity",
      );
    }
  };
  useEffect(() => {
    if (descriptionRef.current)
      descriptionRef.current.innerHTML = sanitizeOrganizationHtml(
        activity?.content || "",
      );
  }, [activity?.content]);
  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = Math.max(
        0,
        (initialTimelineHourRef.current - 2) * 48,
      );
    }
  }, []);
  const formatDescription = (command: string) => {
    descriptionRef.current?.focus();
    document.execCommand(command, false);
    setDescription(descriptionRef.current?.innerHTML || "");
  };
  const start = new Date(startAt);
  const end = new Date(endAt);
  const startHour = start.getHours() + start.getMinutes() / 60;
  const duration = Math.max(0.5, (end.getTime() - start.getTime()) / 3600000);
  const shiftDay = (amount: number) => {
    const nextStart = new Date(start);
    const nextEnd = new Date(end);
    nextStart.setDate(nextStart.getDate() + amount);
    nextEnd.setDate(nextEnd.getDate() + amount);
    setStartAt(local(nextStart));
    setEndAt(local(nextEnd));
  };
  const handleTimelinePointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!timelineInteraction || !timelineRef.current) return;
    const timelineRect = timelineRef.current.getBoundingClientRect();
    const pointerY =
      event.clientY - timelineRect.top + timelineRef.current.scrollTop;
    const pointerMinutes = Math.round(((pointerY / 48) * 60) / 15) * 15;
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes =
      end.toDateString() === start.toDateString()
        ? end.getHours() * 60 + end.getMinutes()
        : 24 * 60;

    if (timelineInteraction === "resize-start") {
      const nextMinutes = Math.max(0, Math.min(endMinutes - 15, pointerMinutes));
      const nextStart = new Date(start);
      nextStart.setHours(0, nextMinutes, 0, 0);
      setStartAt(local(nextStart));
      return;
    }
    if (timelineInteraction === "resize-end") {
      const nextMinutes = Math.max(
        startMinutes + 15,
        Math.min(24 * 60, pointerMinutes),
      );
      const nextEnd = new Date(start);
      nextEnd.setHours(0, nextMinutes, 0, 0);
      setEndAt(local(nextEnd));
      return;
    }

    const durationMinutes = Math.max(
      15,
      Math.round((end.getTime() - start.getTime()) / 60000),
    );
    const rawY = pointerY - dragOffsetRef.current;
    const nextMinutes = Math.max(
      0,
      Math.min(
        24 * 60 - durationMinutes,
        Math.round(((rawY / 48) * 60) / 15) * 15,
      ),
    );
    const nextStart = new Date(start);
    nextStart.setHours(0, nextMinutes, 0, 0);
    const nextEnd = new Date(nextStart.getTime() + durationMinutes * 60000);
    setStartAt(local(nextStart));
    setEndAt(local(nextEnd));
  };
  return (
    <div className="grid overflow-hidden rounded-md border border-border lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-4 p-4">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-11 text-xl"
          placeholder="Activity title"
        />
        <div className="flex flex-wrap gap-2">
          {activityTypes.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              type="button"
              size="icon-lg"
              variant={activityType === id ? "default" : "outline"}
              title={label}
              onClick={() => {
                setActivityType(id);
                setTitle(label);
              }}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            type="datetime-local"
            value={startAt}
            onChange={(event) => setStartAt(event.target.value)}
          />
          <Input
            type="datetime-local"
            value={endAt}
            onChange={(event) => setEndAt(event.target.value)}
          />
        </div>
        <select
          value={priority}
          onChange={(event) =>
            setPriority(
              event.target.value as AccountActivityPayload["priority"],
            )
          }
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="none">No priority</option>
          <option value="high">High priority</option>
          <option value="medium">Medium priority</option>
          <option value="low">Low priority</option>
        </select>
        <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/80 shadow-sm ring-1 ring-amber-100/60 dark:border-amber-900/50 dark:bg-amber-950/20 dark:ring-amber-950/40">
          <div
            ref={descriptionRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Add a description…"
            onInput={(event) => setDescription(event.currentTarget.innerHTML)}
            className="min-h-32 bg-transparent p-4 text-sm leading-6 outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] [&_li]:ml-5 [&_ul]:list-disc"
          />
          <div className="flex gap-1 border-t border-amber-200 bg-background/40 px-3 py-2.5 dark:border-amber-900/50">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onMouseDown={(event) => {
                event.preventDefault();
                formatDescription("bold");
              }}
              title="Bold"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onMouseDown={(event) => {
                event.preventDefault();
                formatDescription("italic");
              }}
              title="Italic"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onMouseDown={(event) => {
                event.preventDefault();
                formatDescription("underline");
              }}
              title="Underline"
            >
              <Underline className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onMouseDown={(event) => {
                event.preventDefault();
                formatDescription("insertUnorderedList");
              }}
              title="List"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="rounded-md border px-3 py-2 text-sm">
          <UserRound className="mr-2 inline h-4 w-4" />
          Organization activity
        </div>
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button size="lg" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button size="lg" onClick={() => void save()} disabled={addActivity.isPending}>
            {addActivity.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save
          </Button>
        </div>
      </div>
      <div className="border-l border-border bg-muted/10">
        <div className="flex items-center justify-between border-b px-3 py-3 text-sm font-semibold">
          <span>
            {start.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </span>
          <span>
            <Button variant="ghost" size="icon-xs" onClick={() => shiftDay(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={() => shiftDay(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </span>
        </div>
        <div
          ref={timelineRef}
          className="relative h-[480px] touch-none overflow-y-auto"
          onPointerMove={handleTimelinePointerMove}
          onPointerUp={() => setTimelineInteraction(null)}
          onPointerCancel={() => setTimelineInteraction(null)}
        >
          <div className="relative h-[1152px]">
            {Array.from({ length: 25 }, (_, hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0 flex h-12 border-t"
                style={{ top: hour * 48 }}
              >
                <span className="w-14 -translate-y-2 pr-2 text-right text-xs text-muted-foreground">
                  {new Date(2000, 0, 1, hour).toLocaleTimeString([], {
                    hour: "numeric",
                  })}
                </span>
              </div>
            ))}
            <div
              role="slider"
              aria-label="Activity time"
              aria-valuetext={`${start.toLocaleTimeString()} to ${end.toLocaleTimeString()}`}
              tabIndex={0}
              onPointerDown={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                dragOffsetRef.current = event.clientY - rect.top;
                event.currentTarget.setPointerCapture(event.pointerId);
                setTimelineInteraction("move");
              }}
              onKeyDown={(event) => {
                if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                event.preventDefault();
                const amount = event.key === "ArrowUp" ? -15 : 15;
                const nextStart = new Date(start.getTime() + amount * 60000);
                const nextEnd = new Date(end.getTime() + amount * 60000);
                if (
                  nextStart.toDateString() !== start.toDateString() ||
                  nextEnd.toDateString() !== end.toDateString()
                )
                  return;
                setStartAt(local(nextStart));
                setEndAt(local(nextEnd));
              }}
              className={`absolute left-16 right-3 z-10 select-none overflow-hidden rounded-sm bg-blue-600 px-2 py-1 text-xs font-semibold text-white shadow ${timelineInteraction === "move" ? "cursor-grabbing ring-2 ring-blue-300" : timelineInteraction ? "ring-2 ring-blue-300" : "cursor-grab"}`}
              style={{
                top: Math.max(0, startHour * 48),
                height: Math.max(32, duration * 48),
              }}
            >
              <span
                aria-hidden="true"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setTimelineInteraction("resize-start");
                }}
                className="absolute inset-x-0 top-0 z-20 h-2 cursor-ns-resize bg-blue-400/0 hover:bg-blue-300/70"
              >
                <span className="absolute left-1/2 top-1 h-0.5 w-8 -translate-x-1/2 rounded-full bg-white/70" />
              </span>
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {title || "Activity"}
              </span>
              <span className="font-normal">
                {start.toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                →{" "}
                {end.toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              <span
                aria-hidden="true"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setTimelineInteraction("resize-end");
                }}
                className="absolute inset-x-0 bottom-0 z-20 h-2 cursor-ns-resize bg-blue-400/0 hover:bg-blue-300/70"
              >
                <span className="absolute bottom-1 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-white/70" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrganizationFileUploader({
  organizationId,
  documentMode = false,
}: {
  organizationId: string;
  documentMode?: boolean;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const { data } = await storageApi.generatePresignedUploadUrl(
          file.name,
          file.type || "application/octet-stream",
          3600,
        );
        await storageApi.uploadFileWithPresignedUrl(data.uploadUrl, file);
        await accountsApi.addTimelineItem(organizationId, {
          type: documentMode ? "document" : "file",
          title: file.name,
          fileName: file.name,
          fileKey: data.fileKey,
          mimeType: file.type,
          size: file.size,
        });
      }
      await queryClient.invalidateQueries({
        queryKey: ["accounts", "detail", organizationId],
      });
      toast.success(`${documentMode ? "Document" : "File"} uploaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  return (
    <div className="flex min-h-28 items-center justify-center rounded-md border-2 border-dashed bg-muted/20">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => void upload(event.target.files)}
      />
      <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        Upload {documentMode ? "documents" : "files"}
      </Button>
    </div>
  );
}

export function AccountDetailsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { accountId } = useParams();
  const { data, isLoading, error } = useAccount(accountId);
  const updateAccount = useUpdateAccount();
  const addNote = useAddAccountNote();
  const updateActivityStatus = useUpdateAccountActivityStatus();
  const [tab, setTab] = useState<ActivityWorkspaceTab>("activity");
  const [activityComposerOpen, setActivityComposerOpen] = useState(false);
  const [note, setNote] = useState("");
  const noteEditorRef = useRef<HTMLDivElement>(null);
  const [noteInsertKind, setNoteInsertKind] = useState<"link" | "image" | null>(
    null,
  );
  const [noteInsertUrl, setNoteInsertUrl] = useState("");
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [labelSearch, setLabelSearch] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [newLabelOpen, setNewLabelOpen] = useState(false);
  const [newLabelColor, setNewLabelColor] =
    useState<(typeof ORGANIZATION_LABEL_SWATCHES)[number]["id"]>("blue");
  const [labelColors, setLabelColors] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(
        window.localStorage.getItem("contact-label-colors") || "{}",
      );
    } catch {
      return {};
    }
  });
  const [expandHistory, setExpandHistory] = useState(false);
  const [historyFilter, setHistoryFilter] =
    useState<OrganizationHistoryFilter>("all");
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [editingActivity, setEditingActivity] = useState<
    AccountDetail["activity"][number] | null
  >(null);
  const [editingNote, setEditingNote] = useState<
    AccountDetail["activity"][number] | null
  >(null);
  const [noteEditDraft, setNoteEditDraft] = useState("");
  const noteEditRef = useRef<HTMLDivElement>(null);
  const [fileDescriptionItem, setFileDescriptionItem] = useState<
    AccountDetail["activity"][number] | null
  >(null);
  const [fileDescriptionDraft, setFileDescriptionDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: "activity" | "note" | "file";
    id: string;
    label: string;
  } | null>(null);
  const [savingAction, setSavingAction] = useState(false);
  const [allDealsOpen, setAllDealsOpen] = useState(false);
  const [dealLinkFilter, setDealLinkFilter] = useState<DealLinkFilter>("all");
  const [peopleDetailsOpen, setPeopleDetailsOpen] = useState(false);
  const [peopleSearch, setPeopleSearch] = useState("");

  if (isLoading)
    return (
      <div className="flex justify-center py-20">
        <Loader size="lg" />
      </div>
    );
  if (error || !data)
    return (
      <div className="rounded-lg border border-destructive/30 p-6 text-destructive">
        {error?.message || "Organization not found"}
      </div>
    );
  const { account, contacts, opportunities, activity } = data;
  const isWonDeal = (stage: string) => stage.toLowerCase().includes("won");
  const isLostDeal = (stage: string) => stage.toLowerCase().includes("lost");
  const wonDeals = opportunities.filter((deal) => isWonDeal(deal.stage));
  const lostDeals = opportunities.filter((deal) => isLostDeal(deal.stage));
  const openDeals = opportunities.filter(
    (deal) => !isWonDeal(deal.stage) && !isLostDeal(deal.stage),
  );
  const closedDealCount = wonDeals.length + lostDeals.length;
  const wonPercentage = closedDealCount
    ? Math.round((wonDeals.length / closedDealCount) * 100)
    : 0;
  const wonValue = wonDeals.reduce((total, deal) => total + deal.value, 0);
  const wonCurrency =
    wonDeals[0]?.currency || opportunities[0]?.currency || "INR";
  const exportDeals = () => {
    const dealsToExport =
      dealLinkFilter === "all" || dealLinkFilter === "direct"
        ? opportunities
        : [];
    const escapeCsv = (value: string | number | null | undefined) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      [
        "Title",
        "Value",
        "Currency",
        "Organization",
        "Contact person",
        "Expected close date",
        "Next activity date",
        "Owner",
      ],
      ...dealsToExport.map((deal) => [
        deal.title,
        deal.value,
        deal.currency,
        account.name,
        deal.primaryContact?.name || "",
        deal.expectedCloseAt || "",
        deal.nextActivityAt || "",
        deal.owner?.name || "Unassigned",
      ]),
    ];
    const blob = new Blob(
      [rows.map((row) => row.map(escapeCsv).join(",")).join("\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${account.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-deals.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const visibleDeals =
    dealLinkFilter === "all" || dealLinkFilter === "direct"
      ? opportunities
      : [];
  const visiblePeople = contacts.filter((contact) =>
    [contact.name, contact.email, contact.phone]
      .join(" ")
      .toLowerCase()
      .includes(peopleSearch.trim().toLowerCase()),
  );
  const contactDealStats = (contactId: string) => {
    const linkedDeals = opportunities.filter(
      (deal) => deal.primaryContact?.id === contactId,
    );
    return {
      closed: linkedDeals.filter(
        (deal) => isWonDeal(deal.stage) || isLostDeal(deal.stage),
      ).length,
      open: linkedDeals.filter(
        (deal) => !isWonDeal(deal.stage) && !isLostDeal(deal.stage),
      ).length,
      nextActivityAt: linkedDeals
        .map((deal) => deal.nextActivityAt)
        .filter((value): value is string => Boolean(value))
        .sort(
          (left, right) => new Date(left).getTime() - new Date(right).getTime(),
        )[0],
    };
  };
  const exportPeople = () => {
    const escapeCsv = (value: string | number | null | undefined) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      [
        "Name",
        "Organization",
        "Email",
        "Phone",
        "Closed deals",
        "Open deals",
        "Next activity date",
        "Owner",
      ],
      ...visiblePeople.map((contact) => {
        const stats = contactDealStats(contact.id);
        return [
          contact.name,
          account.name,
          contact.email,
          contact.phone,
          stats.closed,
          stats.open,
          stats.nextActivityAt || "",
          contact.owner?.name || "Unassigned",
        ];
      }),
    ];
    const blob = new Blob(
      [rows.map((row) => row.map(escapeCsv).join(",")).join("\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${account.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-people.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const scheduledActivities = activity
    .filter(
      (item) =>
        item.type === "activity" && item.status === "scheduled" && item.startAt,
    )
    .sort(
      (a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime(),
    );
  const pinnedNotes = activity.filter(
    (item) => item.type === "note" && item.pinned,
  );
  const save = async (payload: Partial<AccountWritePayload>) => {
    if (!accountId) return;
    try {
      await updateAccount.mutateAsync({ id: accountId, payload });
      toast.success("Organization updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update organization",
      );
      throw err;
    }
  };
  const submitNote = async (event?: FormEvent) => {
    event?.preventDefault();
    const content = sanitizeOrganizationHtml(
      noteEditorRef.current?.innerHTML || note,
    );
    if (!accountId || !organizationText(content)) return;
    try {
      await addNote.mutateAsync({ id: accountId, content });
      setNote("");
      if (noteEditorRef.current) noteEditorRef.current.innerHTML = "";
      toast.success("Note added to history");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add note");
    }
  };
  const formatNote = (command: string) => {
    noteEditorRef.current?.focus();
    document.execCommand(command, false);
    setNote(noteEditorRef.current?.innerHTML || "");
  };
  const insertNoteUrl = () => {
    const url = noteInsertUrl.trim();
    if (!noteInsertKind || !/^https?:\/\//i.test(url))
      return toast.error("Enter a valid http or https URL");
    noteEditorRef.current?.focus();
    document.execCommand(
      noteInsertKind === "link" ? "createLink" : "insertImage",
      false,
      url,
    );
    setNote(noteEditorRef.current?.innerHTML || "");
    setNoteInsertKind(null);
    setNoteInsertUrl("");
  };
  const openLabels = () => {
    setSelectedLabels(account.labels);
    setLabelSearch("");
    setLabelDraft("");
    setNewLabelOpen(false);
    setLabelsOpen(true);
  };
  const saveLabels = async () => {
    await save({ labels: selectedLabels });
    setLabelsOpen(false);
  };
  const addLabel = () => {
    const next = labelDraft.trim();
    if (!next) return;
    const colors = { ...labelColors, [next]: newLabelColor };
    setLabelColors(colors);
    window.localStorage.setItem("contact-label-colors", JSON.stringify(colors));
    setSelectedLabels((labels) => [...new Set([...labels, next])]);
    setNewLabelOpen(false);
    setLabelSearch("");
    setLabelDraft("");
  };
  const completeActivity = async (activityId: string) => {
    if (!accountId) return;
    try {
      await updateActivityStatus.mutateAsync({
        id: accountId,
        activityId,
        status: "done",
      });
      toast.success("Activity marked as done");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to complete activity",
      );
    }
  };
  const refreshOrganization = async () => {
    if (accountId)
      await queryClient.invalidateQueries({
        queryKey: ["accounts", "detail", accountId],
      });
  };
  const toggleNotePin = async (item: AccountDetail["activity"][number]) => {
    if (!accountId) return;
    setOpenActionMenuId(null);
    try {
      await accountsApi.updateNote(accountId, item.id, {
        pinned: !item.pinned,
      });
      await refreshOrganization();
      toast.success(item.pinned ? "Note unpinned" : "Note pinned to focus");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update note",
      );
    }
  };
  const startNoteEdit = (item: AccountDetail["activity"][number]) => {
    setEditingNote(item);
    setNoteEditDraft(sanitizeOrganizationHtml(item.content));
    setOpenActionMenuId(null);
    requestAnimationFrame(() => {
      if (noteEditRef.current)
        noteEditRef.current.innerHTML = sanitizeOrganizationHtml(item.content);
    });
  };
  const saveNoteEdit = async () => {
    if (!accountId || !editingNote) return;
    const content = sanitizeOrganizationHtml(
      noteEditRef.current?.innerHTML || noteEditDraft,
    );
    if (!organizationText(content)) return;
    setSavingAction(true);
    try {
      await accountsApi.updateNote(accountId, editingNote.id, { content });
      await refreshOrganization();
      setEditingNote(null);
      toast.success("Note updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update note",
      );
    } finally {
      setSavingAction(false);
    }
  };
  const saveFileDescription = async () => {
    if (!accountId || !fileDescriptionItem) return;
    setSavingAction(true);
    try {
      await accountsApi.updateTimelineItem(
        accountId,
        fileDescriptionItem.id,
        fileDescriptionDraft.trim(),
      );
      await refreshOrganization();
      setFileDescriptionItem(null);
      toast.success("File description updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update file",
      );
    } finally {
      setSavingAction(false);
    }
  };
  const confirmDelete = async () => {
    if (!accountId || !deleteTarget) return;
    setSavingAction(true);
    try {
      if (deleteTarget.kind === "activity")
        await accountsApi.deleteActivity(accountId, deleteTarget.id);
      else if (deleteTarget.kind === "note")
        await accountsApi.deleteNote(accountId, deleteTarget.id);
      else await accountsApi.deleteTimelineItem(accountId, deleteTarget.id);
      await refreshOrganization();
      setDeleteTarget(null);
      toast.success(`${deleteTarget.label} deleted`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete item",
      );
    } finally {
      setSavingAction(false);
    }
  };
  const availableLabels = [
    ...new Set([...account.labels, ...Object.keys(labelColors)]),
  ].filter((label) => label.toLowerCase().includes(labelSearch.toLowerCase()));
  const filteredActivity =
    historyFilter === "all"
      ? activity
      : activity.filter((item) =>
          historyFilter === "notes"
            ? item.type === "note"
            : historyFilter === "activities"
              ? item.type === "activity"
              : historyFilter === "files"
                ? item.type === "file"
                : historyFilter === "documents"
                  ? item.type === "document"
                  : historyFilter === "deals"
                    ? Boolean(item.opportunity)
                    : historyFilter === "changelog"
                      ? item.type === "organization_created"
                      : false,
        );
  const historyFilters: Array<{
    id: OrganizationHistoryFilter;
    label: string;
    count?: number;
  }> = [
    { id: "all", label: "All" },
    {
      id: "activities",
      label: "Activities",
      count: activity.filter((item) => item.type === "activity").length,
    },
    {
      id: "notes",
      label: "Notes",
      count: activity.filter((item) => item.type === "note").length,
    },
    { id: "whatsapp", label: "WhatsApp" },
    { id: "emails", label: "Emails" },
    { id: "files", label: "Files" },
    { id: "documents", label: "Documents" },
    { id: "leads", label: "Leads" },
    { id: "deals", label: "Deals" },
    { id: "changelog", label: "Changelog" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate("/dashboard/crm/organizations")}
          className="flex min-w-0 items-center gap-3 text-left"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <Building2 className="h-6 w-6" />
          </span>
          <span className="truncate text-2xl font-semibold">
            {account.name}
          </span>
        </button>
        <div className="text-right text-sm">
          <p className="font-medium">{account.owner?.name || "Unassigned"}</p>
          <p className="text-xs text-muted-foreground">Owner</p>
        </div>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
        <Card className="overflow-visible">
          <CardContent className="p-0">
            <section className="border-b border-border p-4">
              <h2 className="mb-4 flex items-center gap-2 font-semibold">
                <ChevronDown className="h-4 w-4" />
                Summary
              </h2>
              <div className="relative space-y-3">
                <button
                  type="button"
                  onClick={openLabels}
                  className="flex items-center gap-3 text-sm font-medium text-primary"
                >
                  <Tag className="h-4 w-4" />
                  {account.labels.length ? (
                    <span className="flex flex-wrap gap-1">
                      {account.labels.map((label) => {
                        const color =
                          ORGANIZATION_LABEL_SWATCHES.find(
                            (swatch) => swatch.id === labelColors[label],
                          ) || ORGANIZATION_LABEL_SWATCHES[0];
                        return (
                          <span
                            key={label}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${color.badge}`}
                          >
                            {label}
                          </span>
                        );
                      })}
                    </span>
                  ) : (
                    "Add labels"
                  )}
                </button>
                {labelsOpen && (
                  <div className="absolute left-0 top-7 z-50 w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
                    {newLabelOpen ? (
                      <>
                        <div className="border-b px-4 py-3 font-semibold">
                          New label
                        </div>
                        <div className="space-y-4 p-4">
                          <div>
                            <p className="mb-1.5 text-sm">Label name</p>
                            <Input
                              autoFocus
                              value={labelDraft}
                              onChange={(event) =>
                                setLabelDraft(event.target.value)
                              }
                              placeholder="Label name"
                            />
                          </div>
                          <div>
                            <p className="mb-2 text-sm">Label color</p>
                            <div className="flex flex-wrap gap-2">
                              {ORGANIZATION_LABEL_SWATCHES.map((swatch) => (
                                <button
                                  key={swatch.id}
                                  type="button"
                                  onClick={() => setNewLabelColor(swatch.id)}
                                  className={`flex h-7 w-7 items-center justify-center rounded-full ${swatch.dot} ${newLabelColor === swatch.id ? "ring-2 ring-blue-500 ring-offset-2" : ""}`}
                                >
                                  {newLabelColor === swatch.id && (
                                    <Check className="h-4 w-4 text-white" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 border-t p-2.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setNewLabelOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={addLabel}
                            disabled={!labelDraft.trim()}
                          >
                            Save
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="p-2">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              autoFocus
                              value={labelSearch}
                              onChange={(event) =>
                                setLabelSearch(event.target.value)
                              }
                              placeholder="Search for labels"
                              className="pl-8"
                            />
                          </div>
                        </div>
                        <div className="max-h-44 overflow-y-auto border-y p-2">
                          {availableLabels.map((label) => {
                            const color =
                              ORGANIZATION_LABEL_SWATCHES.find(
                                (swatch) => swatch.id === labelColors[label],
                              ) || ORGANIZATION_LABEL_SWATCHES[0];
                            const selected = selectedLabels.includes(label);
                            return (
                              <button
                                key={label}
                                type="button"
                                onClick={() =>
                                  setSelectedLabels((labels) =>
                                    selected
                                      ? labels.filter((item) => item !== label)
                                      : [...labels, label],
                                  )
                                }
                                className="flex w-full items-center justify-between rounded px-2 py-2 hover:bg-muted"
                              >
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${color.badge}`}
                                >
                                  {label}
                                </span>
                                {selected && (
                                  <Check className="h-4 w-4 text-primary" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setLabelDraft(labelSearch);
                            setNewLabelOpen(true);
                          }}
                          className="flex w-full items-center gap-2 border-b px-4 py-3 text-sm font-medium text-primary hover:bg-muted"
                        >
                          <Plus className="h-4 w-4" />
                          Add label
                        </button>
                        <div className="flex justify-end gap-2 p-2.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setLabelsOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => void saveLabels()}>
                            Save
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById("organization-address-field")
                      ?.click()
                  }
                  className="flex items-center gap-3 text-sm font-medium text-primary"
                >
                  <MapPin className="h-4 w-4" />
                  {account.address || "Add address"}
                </button>
              </div>
            </section>
            <section className="border-b border-border py-3">
              <div className="px-4 pb-2">
                <h2 className="flex items-center gap-2 font-semibold">
                  <ChevronDown className="h-4 w-4" />
                  Details
                </h2>
              </div>
              <EditableOrganizationField
                label="Organization name"
                value={account.name}
                onSave={(value) => save({ name: value })}
              />
              <EditableOrganizationField
                fieldId="organization-address-field"
                label="Address"
                value={account.address}
                onSave={(value) => save({ address: value })}
              />
              <EditableOrganizationField
                label="Phone"
                value={account.phone}
                onSave={(value) => save({ phone: value })}
              />
              <EditableOrganizationField
                label="Website"
                type="url"
                value={account.website}
                onSave={(value) => save({ website: value })}
              />
              <EditableOrganizationField
                label="LinkedIn profile"
                type="url"
                value={account.linkedinProfile}
                onSave={(value) => save({ linkedinProfile: value })}
              />
              <EditableOrganizationField
                label="Industry"
                value={account.industry}
                onSave={(value) => save({ industry: value })}
              />
              <EditableOrganizationField
                label="Annual revenue"
                type="number"
                value={account.annualRevenue?.toString() || ""}
                onSave={(value) =>
                  save({ annualRevenue: value ? Number(value) : null })
                }
              />
              <EditableOrganizationField
                label="No. of employees"
                type="number"
                value={account.numberOfEmployees?.toString() || ""}
                onSave={(value) =>
                  save({ numberOfEmployees: value ? Number(value) : null })
                }
              />
            </section>
            <section className="border-b border-border p-4">
              <h2 className="mb-3 flex items-center justify-between font-semibold">
                <span className="flex items-center gap-2">
                  <ChevronDown className="h-4 w-4" />
                  Deals
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => navigate("/dashboard/crm/pipeline")}
                  title="Add deal"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </h2>
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  Open deals ({openDeals.length})
                </p>
                <div className="h-4 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-[width]"
                    style={{
                      width: closedDealCount ? `${wonPercentage}%` : "0%",
                    }}
                  />
                </div>
                <div className="grid grid-cols-[1fr_48px_54px_auto] items-center gap-x-2 gap-y-1 text-xs">
                  <span className="font-medium text-emerald-600">Won</span>
                  <span>{wonDeals.length}</span>
                  <span>{wonPercentage}%</span>
                  <span className="text-right font-semibold">
                    {formatDealMoney(wonValue, wonCurrency)}
                  </span>
                  <span className="font-medium text-red-600">Lost</span>
                  <span>{lostDeals.length}</span>
                  <span>{closedDealCount ? 100 - wonPercentage : 0}%</span>
                  <span className="text-right font-semibold">
                    {formatDealMoney(
                      lostDeals.reduce((total, deal) => total + deal.value, 0),
                      lostDeals[0]?.currency || wonCurrency,
                    )}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDealLinkFilter("all");
                    setAllDealsOpen(true);
                  }}
                >
                  See all deals
                </Button>
              </div>
            </section>
            <section className="border-b border-border p-4">
              <h2 className="mb-3 flex items-center justify-between font-semibold">
                <span className="flex items-center gap-2">
                  <ChevronDown className="h-4 w-4" />
                  Related organizations
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => navigate("/dashboard/crm/organizations")}
                  title="Find organization"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </h2>
              <p className="text-sm text-muted-foreground">
                No related organizations linked yet.
              </p>
            </section>
            <section className="p-4">
              <h2 className="mb-3 flex items-center justify-between font-semibold">
                <span className="flex items-center gap-2">
                  <ChevronDown className="h-4 w-4" />
                  People
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => navigate("/dashboard/crm/contacts")}
                  title="Add person"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </h2>
              {contacts.length ? (
                <div className="space-y-2">
                  {contacts.map((contact) => (
                    <Link
                      key={contact.id}
                      to={`/dashboard/crm/contacts/${contact.id}`}
                      className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      <UserRound className="h-4 w-4" />
                      {contact.name}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No people linked yet.
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setPeopleSearch("");
                  setPeopleDetailsOpen(true);
                }}
              >
                View details
              </Button>
            </section>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <ActivityWorkspaceComposer
            tab={tab}
            onTabChange={(nextTab) => {
              setTab(nextTab);
              if (nextTab !== "activity") setActivityComposerOpen(false);
            }}
            flushContent={tab === "activity" && !activityComposerOpen}
          >
            {tab === "notes" ? (
              <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/80 shadow-sm ring-1 ring-amber-100/60 dark:border-amber-900/50 dark:bg-amber-950/20 dark:ring-amber-950/40">
                <div
                  ref={noteEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder="Write a note…"
                  onInput={(event) => setNote(event.currentTarget.innerHTML)}
                  className="min-h-36 max-h-96 overflow-y-auto p-5 text-[15px] leading-6 outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] [&_a]:text-primary [&_a]:underline [&_img]:max-w-full [&_li]:ml-5 [&_ul]:list-disc"
                />
                <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-amber-200 bg-background/40 px-4 py-3 dark:border-amber-900/50">
                  {noteInsertKind && (
                    <div className="absolute bottom-12 left-2 z-50 w-80 rounded-xl border border-border bg-popover p-3 shadow-xl">
                      <p className="mb-2 text-sm font-semibold">
                        Insert {noteInsertKind}
                      </p>
                      <Input
                        autoFocus
                        type="url"
                        value={noteInsertUrl}
                        onChange={(event) =>
                          setNoteInsertUrl(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") insertNoteUrl();
                          if (event.key === "Escape") setNoteInsertKind(null);
                        }}
                        placeholder="https://example.com"
                      />
                      <div className="mt-3 flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setNoteInsertKind(null)}
                        >
                          Cancel
                        </Button>
                        <Button size="sm" onClick={insertNoteUrl}>
                          Insert
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        formatNote("bold");
                      }}
                      title="Bold"
                    >
                      <Bold className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        formatNote("italic");
                      }}
                      title="Italic"
                    >
                      <Italic className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        formatNote("underline");
                      }}
                      title="Underline"
                    >
                      <Underline className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setNoteInsertUrl("");
                        setNoteInsertKind("link");
                      }}
                      title="Link"
                    >
                      <LinkIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        noteEditorRef.current?.focus();
                        document.execCommand("insertText", false, "@");
                      }}
                      title="Mention"
                    >
                      <AtSign className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setNoteInsertUrl("");
                        setNoteInsertKind("image");
                      }}
                      title="Image"
                    >
                      <Image className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        formatNote("insertUnorderedList");
                      }}
                      title="List"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    {note && (
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={() => {
                          setNote("");
                          if (noteEditorRef.current)
                            noteEditorRef.current.innerHTML = "";
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="lg"
                      onClick={() => void submitNote()}
                      disabled={!organizationText(note) || addNote.isPending}
                    >
                      {addNote.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            ) : tab === "activity" ? (
              activityComposerOpen && accountId ? (
                <OrganizationActivityComposer
                  organizationId={accountId}
                  onClose={() => setActivityComposerOpen(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setActivityComposerOpen(true)}
                  className="w-full px-4 py-5 text-left text-sm text-muted-foreground hover:bg-muted/30"
                >
                  Click here to add an activity…
                </button>
              )
            ) : tab === "files" && accountId ? (
              <OrganizationFileUploader organizationId={accountId} />
            ) : tab === "documents" && accountId ? (
              <OrganizationFileUploader
                organizationId={accountId}
                documentMode
              />
            ) : tab === "call" ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {account.phone
                    ? `Call ${account.phone}`
                    : "Add a phone number in Details first."}
                </p>
                {account.phone && (
                  <Button asChild className="mt-3">
                    <a href={`tel:${account.phone}`}>Start call</a>
                  </Button>
                )}
              </div>
            ) : tab === "whatsapp" ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {account.phone
                    ? `Message ${account.phone} on WhatsApp`
                    : "Add a phone number in Details first."}
                </p>
                {account.phone && (
                  <Button asChild className="mt-3">
                    <a
                      href={`https://wa.me/${account.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open WhatsApp
                    </a>
                  </Button>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Email requires a linked person. Choose a person from the left
                panel.
              </div>
            )}
          </ActivityWorkspaceComposer>
          <section>
            <ActivityWorkspaceSectionHeader
              title="Focus"
              expanded={expandHistory}
              onExpandedChange={setExpandHistory}
            />
            {scheduledActivities.length || pinnedNotes.length ? (
              <div className="mt-4 space-y-3">
                {pinnedNotes
                  .slice(0, expandHistory ? undefined : 2)
                  .map((item) => (
                    <div key={`pinned-${item.id}`} className="flex gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background">
                        <Pin className="h-4 w-4 text-amber-600" />
                      </span>
                      <div className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-amber-50/80 p-3 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20">
                        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>Pinned note · {item.actor}</span>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => void toggleNotePin(item)}
                            title="Unpin note"
                          >
                            <Pin className="h-4 w-4" />
                          </Button>
                        </div>
                        <div
                          dangerouslySetInnerHTML={{
                            __html: sanitizeOrganizationHtml(item.content),
                          }}
                          className="text-sm [&_a]:text-primary [&_a]:underline [&_li]:ml-5 [&_ul]:list-disc"
                        />
                      </div>
                    </div>
                  ))}
                {scheduledActivities
                  .slice(
                    0,
                    expandHistory
                      ? undefined
                      : Math.max(0, 2 - pinnedNotes.length),
                  )
                  .map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background">
                        <CalendarDays className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1 rounded-lg border bg-background p-3 shadow-sm">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void completeActivity(item.id)}
                            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border hover:border-emerald-600"
                            title="Mark as done"
                          />
                          <p className="truncate font-semibold">{item.title}</p>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {item.priority && item.priority !== "none" && (
                            <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] uppercase text-white">
                              {item.priority}
                            </span>
                          )}
                          <span>
                            {new Date(item.startAt!).toLocaleString()}
                          </span>
                          <span>· {item.actor}</span>
                        </div>
                        {item.content && (
                          <p className="mt-2 border-t border-amber-200 bg-amber-50/80 px-2 py-2 text-sm">
                            {item.content}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <ActivityWorkspaceEmpty
                title="No focus items yet"
                description="Scheduled activities, pinned notes, email drafts and scheduled emails will appear here."
              />
            )}
          </section>
          <ActivityWorkspaceHistoryCard>
            <ActivityWorkspaceHistoryFilters
              filters={historyFilters}
              active={historyFilter}
              onChange={setHistoryFilter}
            />
            <div>
              {filteredActivity.length ? (
                filteredActivity
                  .slice(0, expandHistory ? undefined : 8)
                  .map((item) => {
                    const isActivity = item.type === "activity";
                    const isFile =
                      item.type === "file" || item.type === "document";
                    const isNote = item.type === "note";
                    const isCompact = !isActivity && !isFile && !isNote;
                    const ItemIcon = isActivity
                      ? CalendarDays
                      : isFile
                        ? FileText
                        : MessageSquare;
                    return (
                      <div
                        key={item.id}
                        className="relative flex gap-3 pb-4 pl-1 before:absolute before:left-5 before:top-10 before:h-[calc(100%-20px)] before:border-l before:border-dashed before:border-border last:before:hidden"
                      >
                        <span
                          className={`z-10 flex shrink-0 items-center justify-center rounded-full border bg-background ${isCompact ? "ml-2 mt-1 h-4 w-4" : "h-10 w-10"}`}
                        >
                          {!isCompact && <ItemIcon className="h-4 w-4" />}
                        </span>
                        <div
                          className={`min-w-0 flex-1 ${isCompact ? "px-1 py-0.5" : `rounded-xl border p-3 shadow-sm ${isNote ? "border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/20" : "bg-background"}`}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              {isActivity && (
                                <span
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${item.status === "done" ? "bg-emerald-600 text-white" : "border"}`}
                                >
                                  {item.status === "done" && (
                                    <Check className="h-3 w-3" />
                                  )}
                                </span>
                              )}
                              {isFile && item.fileKey ? (
                                <a
                                  href={storageApi.getProxyFileUrl(
                                    item.fileKey,
                                  )}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="truncate font-semibold text-primary hover:underline"
                                >
                                  {item.fileName || item.title}
                                </a>
                              ) : isActivity ? (
                                <button
                                  type="button"
                                  onClick={() => setEditingActivity(item)}
                                  className="truncate text-left font-semibold hover:text-primary hover:underline"
                                >
                                  {item.title || "Activity"}
                                </button>
                              ) : (
                                <p
                                  className={
                                    isCompact
                                      ? "text-sm font-medium"
                                      : "font-semibold"
                                  }
                                >
                                  {isNote
                                    ? "Note"
                                    : item.title ||
                                      item.content ||
                                      item.type.replaceAll("_", " ")}
                                </p>
                              )}
                            </div>
                            {(isActivity || isFile || item.type === "note") && (
                              <div className="relative">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() =>
                                    setOpenActionMenuId((value) =>
                                      value === item.id ? null : item.id,
                                    )
                                  }
                                  title="More actions"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                                {openActionMenuId === item.id && (
                                  <div className="absolute right-0 top-8 z-50 w-48 rounded-lg border border-border bg-popover p-1.5 shadow-xl">
                                    {isActivity && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingActivity(item);
                                            setOpenActionMenuId(null);
                                          }}
                                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                                        >
                                          <Pencil className="h-4 w-4" />
                                          Edit
                                        </button>
                                        {item.status !== "done" && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOpenActionMenuId(null);
                                              void completeActivity(item.id);
                                            }}
                                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                                          >
                                            <Check className="h-4 w-4" />
                                            Mark as done
                                          </button>
                                        )}
                                      </>
                                    )}
                                    {item.type === "note" && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => startNoteEdit(item)}
                                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                                        >
                                          <Pencil className="h-4 w-4" />
                                          Edit note
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void toggleNotePin(item)
                                          }
                                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                                        >
                                          <Pin className="h-4 w-4" />
                                          {item.pinned
                                            ? "Unpin this note"
                                            : "Pin this note"}
                                        </button>
                                      </>
                                    )}
                                    {isFile && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setFileDescriptionItem(item);
                                            setFileDescriptionDraft(
                                              item.content || "",
                                            );
                                            setOpenActionMenuId(null);
                                          }}
                                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                                        >
                                          <Pencil className="h-4 w-4" />
                                          Add description
                                        </button>
                                        {item.fileKey && (
                                          <a
                                            href={storageApi.getProxyFileUrl(
                                              item.fileKey,
                                            )}
                                            download={
                                              item.fileName || item.title
                                            }
                                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                                          >
                                            <Save className="h-4 w-4" />
                                            Download
                                          </a>
                                        )}
                                      </>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        setDeleteTarget({
                                          kind: isActivity
                                            ? "activity"
                                            : item.type === "note"
                                              ? "note"
                                              : "file",
                                          id: item.id,
                                          label: isActivity
                                            ? "Activity"
                                            : item.type === "note"
                                              ? "Note"
                                              : item.type === "document"
                                                ? "Document"
                                                : "File",
                                        });
                                      }}
                                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {item.content &&
                            !isCompact &&
                            (isNote ? (
                              <div
                                className="mt-2 text-sm [&_a]:text-primary [&_a]:underline [&_img]:max-w-full [&_li]:ml-5 [&_ul]:list-disc"
                                dangerouslySetInnerHTML={{
                                  __html: sanitizeOrganizationHtml(
                                    item.content,
                                  ),
                                }}
                              />
                            ) : (
                              <p className="mt-2 text-sm">{item.content}</p>
                            ))}
                          {item.opportunity && (
                            <Link
                              to={`/dashboard/crm/pipeline/${item.opportunity.id}`}
                              className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                            >
                              {item.opportunity.title}
                            </Link>
                          )}
                          <p className="mt-2 text-xs text-muted-foreground">
                            {new Date(
                              item.startAt || item.createdAt,
                            ).toLocaleString()}{" "}
                            · {item.actor || "Web App"}
                            {isFile && item.size
                              ? ` · ${Math.ceil(item.size / 1024)}KB · ${account.name}`
                              : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                  No history items in this section yet.
                </div>
              )}
            </div>
          </ActivityWorkspaceHistoryCard>
          {peopleDetailsOpen && (
            <div
              className="fixed inset-0 z-[110] bg-black/50 p-3 sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-labelledby="linked-people-title"
            >
              <div className="mx-auto flex h-full w-full max-w-[1510px] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h2 id="linked-people-title" className="font-semibold">
                    Linked people ({account.name})
                  </h2>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setPeopleDetailsOpen(false)}
                    aria-label="Close linked people"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <div className="relative w-full max-w-xl">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={peopleSearch}
                        onChange={(event) =>
                          setPeopleSearch(event.target.value)
                        }
                        placeholder="Enter person name"
                        className="pl-9"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={() => {
                        setPeopleDetailsOpen(false);
                        navigate("/dashboard/crm/contacts");
                      }}
                    >
                      Link person
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={exportPeople}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export list
                  </Button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  <table className="w-full min-w-[1180px] border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-background text-left">
                      <tr>
                        {[
                          "Name",
                          "Organization",
                          "Email",
                          "Phone",
                          "Closed deals",
                          "Open deals",
                          "Next activity date",
                          "Owner",
                        ].map((column) => (
                          <th
                            key={column}
                            className="border-b border-r px-3 py-2.5 font-semibold last:border-r-0"
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePeople.map((contact) => {
                        const stats = contactDealStats(contact.id);
                        return (
                          <tr key={contact.id} className="hover:bg-muted/30">
                            <td className="border-b border-r px-3 py-2">
                              <Link
                                to={`/dashboard/crm/contacts/${contact.id}`}
                                onClick={() => setPeopleDetailsOpen(false)}
                                className="font-medium text-primary hover:underline"
                              >
                                {contact.name}
                              </Link>
                            </td>
                            <td className="border-b border-r px-3 py-2">
                              {account.name}
                            </td>
                            <td className="border-b border-r px-3 py-2">
                              {contact.email || "—"}
                            </td>
                            <td className="border-b border-r px-3 py-2">
                              {contact.phone || "—"}
                            </td>
                            <td className="border-b border-r px-3 py-2">
                              {stats.closed}
                            </td>
                            <td className="border-b border-r px-3 py-2">
                              {stats.open}
                            </td>
                            <td className="border-b border-r px-3 py-2">
                              {stats.nextActivityAt
                                ? new Date(
                                    stats.nextActivityAt,
                                  ).toLocaleDateString()
                                : "—"}
                            </td>
                            <td className="border-b px-3 py-2">
                              {contact.owner?.name || "Unassigned"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!visiblePeople.length && (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                      No linked people match your search.
                    </div>
                  )}
                </div>
                <div className="flex justify-end border-t px-4 py-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPeopleDetailsOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
          {allDealsOpen && (
            <div
              className="fixed inset-0 z-[110] bg-black/50 p-3 sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-labelledby="linked-deals-title"
            >
              <div className="mx-auto flex h-full w-full max-w-[1510px] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h2 id="linked-deals-title" className="font-semibold">
                    Linked deals ({account.name})
                  </h2>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setAllDealsOpen(false)}
                    aria-label="Close linked deals"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4">
                  <div className="flex gap-1 overflow-x-auto">
                    {(
                      [
                        ["all", "All"],
                        ["direct", "Linked directly"],
                        ["fields", "Linked through fields"],
                        ["participants", "Linked through participants"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setDealLinkFilter(id)}
                        className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold ${dealLinkFilter === id ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" : "hover:bg-muted"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={exportDeals}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export list
                  </Button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  <table className="w-full min-w-[1100px] border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-background text-left">
                      <tr>
                        {[
                          "Title",
                          "Value",
                          "Organization",
                          "Contact person",
                          "Expected close date",
                          "Next activity date",
                          "Owner",
                        ].map((column) => (
                          <th
                            key={column}
                            className="border-b border-r px-3 py-2.5 font-semibold last:border-r-0"
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleDeals.map((deal) => (
                        <tr
                          key={deal.id}
                          className={`${isWonDeal(deal.stage) ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"} hover:bg-muted/30`}
                        >
                          <td className="border-b border-r px-3 py-2">
                            <Link
                              to={`/dashboard/crm/pipeline/${deal.id}`}
                              className="font-medium text-inherit hover:underline"
                              onClick={() => setAllDealsOpen(false)}
                            >
                              {deal.title}
                            </Link>
                          </td>
                          <td className="border-b border-r px-3 py-2 font-medium">
                            {formatDealMoney(deal.value, deal.currency)}
                          </td>
                          <td className="border-b border-r px-3 py-2">
                            {account.name}
                          </td>
                          <td className="border-b border-r px-3 py-2">
                            {deal.primaryContact ? (
                              <Link
                                to={`/dashboard/crm/contacts/${deal.primaryContact.id}`}
                                className="text-inherit hover:underline"
                                onClick={() => setAllDealsOpen(false)}
                              >
                                {deal.primaryContact.name}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="border-b border-r px-3 py-2">
                            {deal.expectedCloseAt
                              ? new Date(
                                  deal.expectedCloseAt,
                                ).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="border-b border-r px-3 py-2">
                            {deal.nextActivityAt
                              ? new Date(
                                  deal.nextActivityAt,
                                ).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="border-b px-3 py-2">
                            {deal.owner?.name || "Unassigned"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!visibleDeals.length && (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                      No deals are linked through this method.
                    </div>
                  )}
                </div>
                <div className="flex justify-end border-t px-4 py-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAllDealsOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
          {editingActivity && accountId && (
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="organization-edit-activity-title"
            >
              <div className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-xl border border-border bg-background shadow-2xl">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-5 py-4">
                  <h2
                    id="organization-edit-activity-title"
                    className="text-lg font-semibold"
                  >
                    Edit activity
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditingActivity(null)}
                    aria-label="Close edit activity"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <div className="p-4">
                  <OrganizationActivityComposer
                    key={editingActivity.id}
                    organizationId={accountId}
                    activity={editingActivity}
                    onClose={() => setEditingActivity(null)}
                  />
                </div>
              </div>
            </div>
          )}
          {editingNote && (
            <div
              className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="organization-edit-note-title"
            >
              <div className="w-full max-w-2xl rounded-xl border border-border bg-background shadow-2xl">
                <div className="flex items-center justify-between border-b px-5 py-4">
                  <h2
                    id="organization-edit-note-title"
                    className="font-semibold"
                  >
                    Edit note
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditingNote(null)}
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <div className="p-5">
                  <div
                    ref={noteEditRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(event) =>
                      setNoteEditDraft(event.currentTarget.innerHTML)
                    }
                    className="min-h-32 rounded-md border border-amber-200 bg-amber-50/60 p-3 text-sm outline-none focus:ring-2 focus:ring-ring [&_a]:text-primary [&_a]:underline [&_li]:ml-5 [&_ul]:list-disc"
                  />
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setEditingNote(null)}
                      disabled={savingAction}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => void saveNoteEdit()}
                      disabled={savingAction}
                    >
                      {savingAction && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {fileDescriptionItem && (
            <div
              className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="organization-file-description-title"
            >
              <div className="w-full max-w-lg rounded-xl border border-border bg-background shadow-2xl">
                <div className="flex items-center justify-between border-b px-5 py-4">
                  <h2
                    id="organization-file-description-title"
                    className="font-semibold"
                  >
                    Add file description
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setFileDescriptionItem(null)}
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <div className="space-y-4 p-5">
                  <p className="truncate text-sm font-medium">
                    {fileDescriptionItem.fileName || fileDescriptionItem.title}
                  </p>
                  <textarea
                    autoFocus
                    value={fileDescriptionDraft}
                    onChange={(event) =>
                      setFileDescriptionDraft(event.target.value)
                    }
                    rows={5}
                    maxLength={20000}
                    placeholder="Add a description…"
                    className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setFileDescriptionItem(null)}
                      disabled={savingAction}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => void saveFileDescription()}
                      disabled={savingAction}
                    >
                      {savingAction && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {deleteTarget && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="organization-delete-item-title"
            >
              <div className="w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-2xl">
                <h2
                  id="organization-delete-item-title"
                  className="font-semibold"
                >
                  Delete {deleteTarget.label.toLowerCase()}?
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  This action cannot be undone.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteTarget(null)}
                    disabled={savingAction}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => void confirmDelete()}
                    disabled={savingAction}
                  >
                    {savingAction && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
