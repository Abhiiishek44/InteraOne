import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import {
  AlignLeft,
  AtSign,
  ArrowLeft,
  Bold,
  Building2,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDollarSign,
  ExternalLink,
  FileText,
  Flag,
  Italic,
  Link,
  List,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  StickyNote,
  Tag,
  Trash2,
  Underline,
  UserRound,
  Users,
  Utensils,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { DeleteConfirmDialog } from "@/shared/components/delete-confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  useAccounts,
  useUpdateAccount,
} from "@/domains/accounts/hooks/use-accounts";
import {
  useContactOwners,
  useContacts,
  useUpdateContact,
} from "@/domains/contacts/hooks/use-contacts";
import {
  EmailComposer,
  ContactFileWorkspace,
} from "@/domains/contacts/pages/contact-details-page";
import { sanitizeNoteHtml } from "@/shared/lib/note-html";
import { contactsApi } from "@/domains/contacts/api/contacts.api";
import {
  toContactViewModel,
  type ContactTimelineItem,
} from "@/domains/contacts/types/types";
import { storageApi } from "@/shared/lib/storage.api";
import { WhatsAppIcon } from "@/shared/ui/channel-icon";
import { useAuth } from "@/domains/auth/hooks/useAuth";
import {
  ActivityWorkspaceComposer,
  ActivityWorkspaceEmpty,
  ActivityWorkspaceHistoryFilters,
  ActivityWorkspaceSectionHeader,
  type ActivityWorkspaceTab,
  type ActivityWorkspaceTabItem,
} from "../components/activity-workspace-ui";
import {
  useAddCrmRecordActivity,
  useCompleteCrmRecordActivity,
  useConvertLead,
  useDeleteCrmRecordActivity,
  useLeads,
  useUpdateCrmRecordActivity,
  useUpdateCrmRecord,
} from "../hooks/use-crm-records";
import type { CrmRecord } from "../types/types";

type HistoryFilter = "all" | "activities" | "notes" | "files";
type LeadActivityKind = "call" | "meeting" | "task" | "deadline" | "lunch";
export type LeadActivityDraft = {
  title: string;
  startAt: Date;
  endAt: Date;
  kind: LeadActivityKind;
  priority: "none" | "low" | "medium" | "high";
  description: string;
  location: string;
  videoCallUrl: string;
  availability: "free" | "busy";
  markDone: boolean;
};

const LEAD_WORKSPACE_TABS: readonly ActivityWorkspaceTabItem[] = [
  { id: "notes", label: "Notes", icon: StickyNote, iconClass: "text-blue-600" },
  {
    id: "activity",
    label: "Activity",
    icon: CalendarDays,
    iconClass: "text-slate-600",
  },
  { id: "whatsapp", label: "WhatsApp", icon: WhatsAppIcon, iconClass: "" },
  { id: "email", label: "Email", icon: Mail, iconClass: "text-slate-600" },
  { id: "files", label: "Files", icon: Paperclip, iconClass: "text-slate-600" },
] as const;

const DEFAULT_LABELS = [
  "Hot lead",
  "Warm lead",
  "Cold lead",
  "Customer",
  "VIP",
  "Enterprise",
  "Trial",
  "Billing",
  "At Risk",
];

const LABEL_SWATCHES = [
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

type EditableLeadField =
  | "title"
  | "labels"
  | "value"
  | "expectedCloseAt"
  | "ownerId"
  | "sourceOrigin"
  | "sourceChannel"
  | "sourceChannelId"
  | "contactId"
  | "contactLabels"
  | "phone"
  | "email"
  | "accountId"
  | "accountLabels"
  | "address"
  | "website"
  | "linkedinProfile"
  | "industry"
  | "annualRevenue"
  | "numberOfEmployees";

const money = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);

const formatHistoryDate = (value: string) => {
  const date = new Date(value);
  const today = new Date();
  const label =
    date.toDateString() === today.toDateString()
      ? "Today"
      : date.toLocaleDateString();
  return `${label} at ${date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
};

const formatFileSize = (size?: number) => {
  if (!size) return "File";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

type LeadDetailsPageProps = {
  leadId?: string;
  embedded?: boolean;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose?: () => void;
  showNavigationControls?: boolean;
};

export function LeadDetailsPage({
  leadId: leadIdProp,
  embedded = false,
  hasPrevious = false,
  hasNext = false,
  onPrevious,
  onNext,
  onClose,
  showNavigationControls = true,
}: LeadDetailsPageProps = {}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { leadId: routeLeadId } = useParams<{ leadId: string }>();
  const leadId = leadIdProp || routeLeadId;
  const { data: leads = [], isLoading } = useLeads();
  const { data: contacts = [] } = useContacts();
  const { data: accountsData } = useAccounts("", 200);
  const { data: owners = [] } = useContactOwners();
  const lead = leads.find((item) => item.id === leadId);
  const addActivity = useAddCrmRecordActivity("lead");
  const completeActivity = useCompleteCrmRecordActivity("lead");
  const updateActivity = useUpdateCrmRecordActivity("lead");
  const deleteActivity = useDeleteCrmRecordActivity("lead");
  const updateLead = useUpdateCrmRecord("lead");
  const convertLead = useConvertLead();
  const updateContact = useUpdateContact();
  const updateAccount = useUpdateAccount();
  const [tab, setTab] = useState<ActivityWorkspaceTab>("notes");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState("");
  const [noteComposerOpen, setNoteComposerOpen] = useState(false);
  const noteEditorRef = useRef<HTMLDivElement>(null);
  const [activityComposerOpen, setActivityComposerOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<
    CrmRecord["activities"][number] | null
  >(null);
  const [openActivityMenuId, setOpenActivityMenuId] = useState<string | null>(
    null,
  );
  const [deleteActivityTarget, setDeleteActivityTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [fileDescriptionTarget, setFileDescriptionTarget] =
    useState<ContactTimelineItem | null>(null);
  const [fileDescription, setFileDescription] = useState("");
  const [savingFileDescription, setSavingFileDescription] = useState(false);
  const [deleteFileTarget, setDeleteFileTarget] =
    useState<ContactTimelineItem | null>(null);
  const [deletingFile, setDeletingFile] = useState(false);
  const [editingField, setEditingField] = useState<EditableLeadField | null>(
    null,
  );
  const [editValue, setEditValue] = useState("");
  const [editCurrency, setEditCurrency] = useState<
    "USD" | "INR" | "EUR" | "GBP"
  >("INR");
  const [editMethodType, setEditMethodType] = useState<
    "work" | "home" | "mobile" | "other"
  >("work");
  const linkedContact = useMemo(() => {
    const contact = contacts.find((item) => item.id === lead?.contact?.id);
    return contact ? toContactViewModel(contact) : null;
  }, [contacts, lead?.contact?.id]);

  const planned = useMemo(
    () =>
      (lead?.activities || [])
        .filter(
          (activity) => activity.type === "planned" && !activity.completedAt,
        )
        .sort(
          (a, b) =>
            new Date(a.dueAt || 0).getTime() - new Date(b.dueAt || 0).getTime(),
        ),
    [lead?.activities],
  );
  const historyItems = useMemo(
    () =>
      (lead?.activities || []).filter(
        (item) => item.type !== "planned" || Boolean(item.completedAt),
      ),
    [lead?.activities],
  );
  const history = useMemo(() => {
    const items = historyItems;
    if (historyFilter === "notes")
      return items.filter((item) => item.type === "note");
    if (historyFilter === "activities")
      return items.filter((item) => item.type !== "note");
    if (historyFilter === "files") return [];
    return items;
  }, [historyFilter, historyItems]);
  const fileHistoryItems = useMemo(
    () =>
      (linkedContact?.timelineItems || [])
        .filter((item) => item.type === "file" || item.type === "document")
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [linkedContact?.timelineItems],
  );
  const visibleFileHistoryItems =
    historyFilter === "all" || historyFilter === "files"
      ? fileHistoryItems
      : [];

  if (isLoading)
    return (
      <div className="py-20 text-center text-muted-foreground">
        Loading lead…
      </div>
    );
  if (!lead) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <h1 className="text-lg font-semibold">Lead not found</h1>
          <Button
            className="mt-4"
            onClick={() =>
              embedded ? onClose?.() : navigate("/dashboard/crm/leads")
            }
          >
            Back to leads
          </Button>
        </CardContent>
      </Card>
    );
  }

  const saveNote = async () => {
    const content = sanitizeNoteHtml(
      noteEditorRef.current?.innerHTML.trim() || note.trim(),
    );
    if (!content) return;
    try {
      await addActivity.mutateAsync({
        id: lead.id,
        content,
        category: "todo",
      });
      setNote("");
      if (noteEditorRef.current) noteEditorRef.current.innerHTML = "";
      setNoteComposerOpen(false);
      toast.success("Note added");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add note",
      );
    }
  };

  const scheduleActivity = async (draft: LeadActivityDraft) => {
    try {
      const payload = {
        content: draft.title.trim(),
        dueAt: draft.startAt.toISOString(),
        category: (draft.kind === "meeting"
          ? "meeting"
          : draft.kind === "call"
            ? "call"
            : "todo") as "todo" | "call" | "meeting",
        durationMinutes: Math.round(
          (draft.endAt.getTime() - draft.startAt.getTime()) / 60000,
        ),
        customFields: {
          activityType: draft.kind,
          priority: draft.priority,
          description: draft.description,
          location: draft.location.trim(),
          videoCallUrl: draft.videoCallUrl.trim(),
          availability: draft.availability,
          endAt: draft.endAt.toISOString(),
        },
      };
      const activity = editingActivity
        ? (await updateActivity.mutateAsync({
            id: lead.id,
            activityId: editingActivity.id,
            payload,
          }),
          editingActivity)
        : await addActivity.mutateAsync({ id: lead.id, ...payload });
      if (draft.markDone && !activity.completedAt) {
        await completeActivity.mutateAsync({
          id: lead.id,
          activityId: activity.id,
        });
      }
      setActivityComposerOpen(false);
      setEditingActivity(null);
      toast.success(
        editingActivity ? "Activity updated" : "Activity scheduled",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : editingActivity
            ? "Failed to update activity"
            : "Failed to schedule activity",
      );
    }
  };

  const beginEdit = (field: EditableLeadField, value: string) => {
    setEditingField(field);
    setEditValue(value);
    if (field === "value") setEditCurrency(lead.currency);
    if (field === "phone")
      setEditMethodType(lead.contact?.phones?.[0]?.type || "work");
    if (field === "email")
      setEditMethodType(lead.contact?.emails?.[0]?.type || "work");
  };

  const saveField = async () => {
    if (!editingField) return;
    try {
      if (["phone", "email", "contactLabels"].includes(editingField)) {
        if (!lead.contact?.id)
          throw new Error("Link a contact before editing this field");
        if (editingField === "phone") {
          await updateContact.mutateAsync({
            id: lead.contact.id,
            phone: editValue.trim(),
            phones: [
              { value: editValue.trim(), type: editMethodType },
              ...(lead.contact.phones || []).slice(1),
            ].filter((item) => item.value),
          });
        } else if (editingField === "email") {
          await updateContact.mutateAsync({
            id: lead.contact.id,
            email: editValue.trim(),
            emails: [
              { value: editValue.trim(), type: editMethodType },
              ...(lead.contact.emails || []).slice(1),
            ].filter((item) => item.value),
          });
        } else {
          await updateContact.mutateAsync({
            id: lead.contact.id,
            tags: editValue
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          });
        }
      } else if (
        [
          "accountLabels",
          "address",
          "website",
          "linkedinProfile",
          "industry",
          "annualRevenue",
          "numberOfEmployees",
        ].includes(editingField)
      ) {
        if (!lead.account?.id)
          throw new Error("Link an organization before editing this field");
        await updateAccount.mutateAsync({
          id: lead.account.id,
          payload: {
            [editingField === "accountLabels" ? "labels" : editingField]:
              editingField === "accountLabels"
                ? editValue
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean)
                : editingField === "numberOfEmployees" ||
                    editingField === "annualRevenue"
                  ? editValue
                    ? Number(editValue)
                    : null
                  : editValue.trim(),
          },
        });
      } else {
        const value =
          editingField === "value"
            ? Number(editValue) || 0
            : editingField === "labels"
              ? editValue
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              : editingField === "ownerId" ||
                  editingField === "contactId" ||
                  editingField === "accountId"
                ? editValue === "none"
                  ? null
                  : editValue
                : editingField === "expectedCloseAt"
                  ? editValue || null
                  : editValue.trim();
        const apiField =
          editingField === "contactId" ? "primaryContactId" : editingField;
        await updateLead.mutateAsync({
          id: lead.id,
          [apiField]: value,
          ...(editingField === "value" ? { currency: editCurrency } : {}),
        });
      }
      setEditingField(null);
      toast.success("Field updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update field",
      );
    }
  };

  const editLeadActivity = (activity: CrmRecord["activities"][number]) => {
    setOpenActivityMenuId(null);
    setEditingActivity(activity);
    setTab("activity");
    setActivityComposerOpen(false);
  };

  const removeLeadActivity = async () => {
    if (!deleteActivityTarget) return;
    try {
      await deleteActivity.mutateAsync({
        id: lead.id,
        activityId: deleteActivityTarget.id,
      });
      setDeleteActivityTarget(null);
      toast.success("Activity deleted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete activity",
      );
    }
  };

  const openFileDescription = (item: ContactTimelineItem) => {
    setOpenActivityMenuId(null);
    setFileDescriptionTarget(item);
    setFileDescription(item.content || "");
  };

  const saveFileDescription = async () => {
    if (!linkedContact || !fileDescriptionTarget) return;
    setSavingFileDescription(true);
    try {
      await contactsApi.updateTimelineItem(
        linkedContact.id,
        fileDescriptionTarget.id,
        fileDescription.trim(),
      );
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setFileDescriptionTarget(null);
      toast.success("File description updated");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update file description",
      );
    } finally {
      setSavingFileDescription(false);
    }
  };

  const removeLeadFile = async () => {
    if (!linkedContact || !deleteFileTarget) return;
    setDeletingFile(true);
    try {
      await contactsApi.deleteTimelineItem(
        linkedContact.id,
        deleteFileTarget.id,
      );
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setDeleteFileTarget(null);
      toast.success("File deleted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete file",
      );
    } finally {
      setDeletingFile(false);
    }
  };

  const labelOptions = Array.from(
    new Set([
      ...DEFAULT_LABELS,
      ...leads.flatMap((item) => item.labels || []),
      ...contacts.flatMap((contact) => contact.tags || []),
    ]),
  );

  return (
    <div
      className={
        embedded
          ? "flex h-full min-h-0 flex-col overflow-hidden bg-muted/20"
          : "-m-4 flex min-h-[calc(100vh-4rem)] flex-col bg-muted/20 sm:-m-6"
      }
    >
      <header className="flex items-center justify-between gap-3 border-b bg-background px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {!embedded && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard/crm/leads")}
              title="Back to leads"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{lead.title}</h1>
            <p className="text-xs text-muted-foreground">Lead workspace</p>
          </div>
        </div>
        {embedded && showNavigationControls ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrevious}
              disabled={!hasPrevious}
              title="Previous lead"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNext}
              disabled={!hasNext}
              title="Next lead"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              title="Close lead details"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : !embedded ? (
          <span className="hidden text-xs text-muted-foreground sm:block">
            Select any field in the left panel to edit it
          </span>
        ) : null}
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[390px_minmax(0,1fr)]">
        <aside
          className={`flex min-h-0 flex-col border-r bg-background ${embedded ? "h-full" : "max-h-[calc(100vh-8rem)]"}`}
        >
          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            <LeadSection title="Summary">
              <div className="space-y-1">
                <EditableDetail
                  icon={Pencil}
                  field="title"
                  label="Title"
                  value={lead.title}
                  rawValue={lead.title}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateLead.isPending}
                />
                <EditableDetail
                  icon={Tag}
                  field="labels"
                  label="Labels"
                  value={
                    lead.labels?.length ? lead.labels.join(", ") : "No labels"
                  }
                  rawValue={(lead.labels || []).join(", ")}
                  displayValue={<LabelBadgeList labels={lead.labels || []} />}
                  placeholder="HOT LEAD, WARM LEAD"
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateLead.isPending}
                  editor={
                    <CustomLabelEditor
                      value={editValue}
                      options={labelOptions}
                      onChange={setEditValue}
                    />
                  }
                />
                <EditableDetail
                  icon={CircleDollarSign}
                  field="value"
                  label="Value"
                  value={money(lead.value, lead.currency)}
                  rawValue={String(lead.value)}
                  inputType="number"
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateLead.isPending}
                />
                <EditableDetail
                  icon={CalendarDays}
                  field="expectedCloseAt"
                  label="Expected close"
                  value={
                    lead.expectedCloseAt
                      ? new Date(lead.expectedCloseAt).toLocaleDateString()
                      : "Not set"
                  }
                  rawValue={lead.expectedCloseAt?.slice(0, 10) || ""}
                  inputType="date"
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateLead.isPending}
                />
              </div>
            </LeadSection>

            <LeadSection title="Details">
              <div className="space-y-1">
                <EditableDetail
                  icon={UserRound}
                  field="ownerId"
                  label="Owner"
                  value={lead.owner?.name || "Unassigned"}
                  rawValue={lead.owner?.id || "none"}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateLead.isPending}
                  editor={
                    <Select value={editValue} onValueChange={setEditValue}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {owners.map((owner) => (
                          <SelectItem key={owner.id} value={owner.id}>
                            {owner.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  }
                />
                <EditableDetail
                  icon={ExternalLink}
                  field="sourceOrigin"
                  label="Source origin"
                  value={
                    lead.sourceOrigin === "manual"
                      ? "Manually created"
                      : lead.sourceOrigin || "Unknown"
                  }
                  rawValue={lead.sourceOrigin || "manual"}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateLead.isPending}
                />
                <EditableDetail
                  icon={ExternalLink}
                  field="sourceChannel"
                  label="Source channel"
                  value={lead.sourceChannel || "Not set"}
                  rawValue={lead.sourceChannel || ""}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateLead.isPending}
                />
                <EditableDetail
                  icon={ExternalLink}
                  field="sourceChannelId"
                  label="Source channel ID"
                  value={lead.sourceChannelId || "Not set"}
                  rawValue={lead.sourceChannelId || ""}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateLead.isPending}
                />
              </div>
            </LeadSection>

            <LeadSection title="Person">
              <div className="space-y-1">
                <EditableDetail
                  icon={UserRound}
                  field="contactId"
                  label="Contact"
                  value={lead.contact?.name || "Not linked"}
                  rawValue={lead.contact?.id || "none"}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateLead.isPending}
                  editor={
                    <Select value={editValue} onValueChange={setEditValue}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not linked</SelectItem>
                        {contacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.name}
                            {contact.company ? ` · ${contact.company}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  }
                />
                <EditableDetail
                  icon={Phone}
                  field="phone"
                  label="Phone"
                  value={lead.contact?.phone || "Not provided"}
                  rawValue={lead.contact?.phone || ""}
                  inputType="tel"
                  disabled={!lead.contact?.id}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateContact.isPending}
                  editor={
                    <ContactMethodEditor
                      type="tel"
                      value={editValue}
                      methodType={editMethodType}
                      onValueChange={setEditValue}
                      onTypeChange={setEditMethodType}
                    />
                  }
                />
                <EditableDetail
                  icon={Mail}
                  field="email"
                  label="Email"
                  value={lead.contact?.email || "Not provided"}
                  rawValue={lead.contact?.email || ""}
                  inputType="email"
                  disabled={!lead.contact?.id}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateContact.isPending}
                  editor={
                    <ContactMethodEditor
                      type="email"
                      value={editValue}
                      methodType={editMethodType}
                      onValueChange={setEditValue}
                      onTypeChange={setEditMethodType}
                    />
                  }
                />
                <EditableDetail
                  icon={Tag}
                  field="contactLabels"
                  label="Labels"
                  value={
                    linkedContact?.tags.length
                      ? linkedContact.tags.join(", ")
                      : "No labels"
                  }
                  rawValue={(linkedContact?.tags || []).join(", ")}
                  displayValue={
                    <LabelBadgeList labels={linkedContact?.tags || []} />
                  }
                  disabled={!lead.contact?.id}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateContact.isPending}
                  editor={
                    <CustomLabelEditor
                      value={editValue}
                      options={labelOptions}
                      onChange={setEditValue}
                    />
                  }
                />
              </div>
            </LeadSection>

            <LeadSection title="Organization">
              <div className="space-y-1">
                <EditableDetail
                  icon={Building2}
                  field="accountId"
                  label="Organization"
                  value={lead.account?.name || lead.company || "Not linked"}
                  rawValue={lead.account?.id || "none"}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateLead.isPending}
                  editor={
                    <Select value={editValue} onValueChange={setEditValue}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not linked</SelectItem>
                        {(accountsData?.accounts || []).map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  }
                />
                <EditableDetail
                  icon={MapPin}
                  field="address"
                  label="Address"
                  value={lead.account?.address || "Not provided"}
                  rawValue={lead.account?.address || ""}
                  disabled={!lead.account?.id}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateAccount.isPending}
                />
                <EditableDetail
                  icon={ExternalLink}
                  field="website"
                  label="Website"
                  value={lead.account?.website || "Not provided"}
                  rawValue={lead.account?.website || ""}
                  inputType="url"
                  disabled={!lead.account?.id}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateAccount.isPending}
                />
                <EditableDetail
                  icon={ExternalLink}
                  field="linkedinProfile"
                  label="LinkedIn profile"
                  value={lead.account?.linkedinProfile || "Not provided"}
                  rawValue={lead.account?.linkedinProfile || ""}
                  inputType="url"
                  disabled={!lead.account?.id}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateAccount.isPending}
                />
                <EditableDetail
                  icon={Building2}
                  field="industry"
                  label="Industry"
                  value={lead.account?.industry || "Not provided"}
                  rawValue={lead.account?.industry || ""}
                  disabled={!lead.account?.id}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateAccount.isPending}
                />
                <EditableDetail
                  icon={UserRound}
                  field="annualRevenue"
                  label="Annual revenue"
                  value={
                    lead.account?.annualRevenue
                      ? money(lead.account.annualRevenue, lead.currency)
                      : "Not provided"
                  }
                  rawValue={lead.account?.annualRevenue?.toString() || ""}
                  inputType="number"
                  disabled={!lead.account?.id}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateAccount.isPending}
                />
                <EditableDetail
                  icon={UserRound}
                  field="numberOfEmployees"
                  label="No. of employees"
                  value={
                    lead.account?.numberOfEmployees?.toString() ||
                    "Not provided"
                  }
                  rawValue={lead.account?.numberOfEmployees?.toString() || ""}
                  inputType="number"
                  disabled={!lead.account?.id}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateAccount.isPending}
                />
              </div>
            </LeadSection>
          </div>
          <div className="flex items-center justify-end gap-2 border-t p-4">
            <Button
              onClick={async () => {
                await convertLead.mutateAsync(lead.id);
                toast.success("Lead converted to deal");
                navigate(`/dashboard/crm/pipeline/${lead.id}`);
              }}
              disabled={convertLead.isPending}
            >
              Convert to deal
            </Button>
          </div>
        </aside>

        <main
          className={`${embedded ? "h-full min-h-0" : "max-h-[calc(100vh-8rem)]"} overflow-y-auto p-4 sm:p-6`}
        >
          <div className="mx-auto max-w-5xl space-y-7">
            <div>
              <ActivityWorkspaceComposer
                tab={tab}
                tabs={LEAD_WORKSPACE_TABS}
                flushContent={
                  (tab === "notes" && !noteComposerOpen) ||
                  (tab === "activity" && !activityComposerOpen)
                }
                onTabChange={(nextTab) => {
                  setTab(nextTab);
                  if (nextTab !== "notes") setNoteComposerOpen(false);
                  if (nextTab !== "activity") {
                    setActivityComposerOpen(false);
                    setEditingActivity(null);
                  }
                }}
              >
                {tab === "notes" ? (
                  noteComposerOpen ? (
                    <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/80 shadow-sm ring-1 ring-amber-100/60 dark:border-amber-900/50 dark:bg-amber-950/20 dark:ring-amber-950/40">
                      <div
                        ref={noteEditorRef}
                        contentEditable
                        suppressContentEditableWarning
                        role="textbox"
                        aria-label="Lead note"
                        data-placeholder="Take a note, @name…"
                        onInput={(event) =>
                          setNote(event.currentTarget.innerHTML)
                        }
                        className="min-h-36 max-h-96 overflow-y-auto p-5 text-[15px] leading-6 outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-200/80 bg-background/40 px-4 py-3 dark:border-amber-900/50">
                        <div className="flex flex-wrap items-center gap-1">
                          {(
                            [
                              ["Bold", Bold, "bold"],
                              ["Italic", Italic, "italic"],
                              ["Underline", Underline, "underline"],
                              ["Link", Link, "createLink"],
                              ["Mention", AtSign, "insertText"],
                              ["List", List, "insertUnorderedList"],
                            ] as const
                          ).map(([label, Icon, command]) => (
                            <Button
                              key={String(label)}
                              type="button"
                              variant="ghost"
                              size="icon"
                              title={String(label)}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                noteEditorRef.current?.focus();
                                if (command === "createLink") {
                                  const url = window.prompt("Link URL");
                                  if (url)
                                    document.execCommand(
                                      String(command),
                                      false,
                                      url,
                                    );
                                } else {
                                  document.execCommand(
                                    String(command),
                                    false,
                                    command === "insertText" ? "@" : undefined,
                                  );
                                }
                                setNote(noteEditorRef.current?.innerHTML || "");
                              }}
                            >
                              <Icon className="h-4 w-4" />
                            </Button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="lg"
                            variant="outline"
                            onClick={() => {
                              setNote("");
                              setNoteComposerOpen(false);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="lg"
                            onClick={saveNote}
                            disabled={!note.trim() || addActivity.isPending}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setNoteComposerOpen(true)}
                      className="w-full px-4 py-5 text-left text-sm text-muted-foreground hover:bg-muted/30"
                    >
                      Take a note, @name…
                    </button>
                  )
                ) : tab === "activity" ? (
                  activityComposerOpen ? (
                    <LeadActivityComposer
                      key={editingActivity?.id || "new-activity"}
                      activity={editingActivity || undefined}
                      activities={lead.activities}
                      contactName={lead.contact?.name}
                      companyName={lead.account?.name || lead.company}
                      saving={
                        addActivity.isPending ||
                        updateActivity.isPending ||
                        completeActivity.isPending
                      }
                      onCancel={() => {
                        setActivityComposerOpen(false);
                        setEditingActivity(null);
                      }}
                      onSave={scheduleActivity}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingActivity(null);
                        setActivityComposerOpen(true);
                      }}
                      className="w-full px-4 py-5 text-left text-sm text-muted-foreground hover:bg-muted/30"
                    >
                      Click here to add an activity…
                    </button>
                  )
                ) : tab === "email" && linkedContact ? (
                  <EmailComposer contact={linkedContact} />
                ) : tab === "files" && linkedContact ? (
                  <ContactFileWorkspace contact={linkedContact} />
                ) : tab === "whatsapp" ? (
                  <div className="flex min-h-28 flex-col items-center justify-center text-center">
                    <WhatsAppIcon className="h-6 w-6" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      {lead.contact?.phone
                        ? `Message ${lead.contact.phone} on WhatsApp.`
                        : "Add a phone number to use WhatsApp."}
                    </p>
                    {lead.contact?.phone ? (
                      <Button asChild size="sm" className="mt-3">
                        <a
                          href={`https://wa.me/${lead.contact.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open WhatsApp
                        </a>
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <ActivityWorkspaceEmpty
                    title="Link a person to continue"
                    description="Email and file activity needs a linked person record."
                  />
                )}
              </ActivityWorkspaceComposer>
            </div>

            <section className="px-1">
              <ActivityWorkspaceSectionHeader
                title="Focus"
                expanded={expanded}
                onExpandedChange={setExpanded}
              />
              {planned.length ? (
                <div className="mt-4 grid gap-3">
                  {(expanded ? planned : planned.slice(0, 3)).map(
                    (activity) => {
                      const activityKind = String(
                        activity.customFields?.activityType ||
                          activity.category,
                      );
                      const ActivityIcon =
                        activityKind === "call"
                          ? Phone
                          : activityKind === "meeting"
                            ? Users
                            : activityKind === "deadline"
                              ? Flag
                              : activityKind === "lunch"
                                ? Utensils
                                : CheckSquare;
                      const dueDate = activity.dueAt
                        ? new Date(activity.dueAt)
                        : null;
                      const overdue = Boolean(
                        dueDate && dueDate.getTime() < Date.now(),
                      );
                      const priority = String(
                        activity.customFields?.priority || "none",
                      );
                      const description =
                        typeof activity.customFields?.description === "string"
                          ? activity.customFields.description
                              .replace(/<[^>]+>/g, " ")
                              .replace(/\s+/g, " ")
                              .trim()
                          : "";
                      return (
                        <div
                          key={activity.id}
                          className="relative flex gap-3 pl-1 before:absolute before:left-5 before:top-10 before:h-[calc(100%+12px)] before:border-l before:border-dashed before:border-border last:before:hidden"
                        >
                          <span className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background">
                            <ActivityIcon className="h-4 w-4 text-muted-foreground" />
                          </span>
                          <div className="min-w-0 flex-1 overflow-visible rounded-lg border border-border bg-background shadow-sm">
                            <div className="p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      completeActivity.mutate({
                                        id: lead.id,
                                        activityId: activity.id,
                                      })
                                    }
                                    disabled={completeActivity.isPending}
                                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 text-emerald-600 hover:border-emerald-600"
                                    title="Mark as done"
                                    aria-label={`Mark ${activity.content} as done`}
                                  >
                                    {completeActivity.isPending &&
                                      completeActivity.variables?.activityId ===
                                        activity.id && (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      )}
                                  </button>
                                  <p className="truncate font-semibold">
                                    {activity.content}
                                  </p>
                                </div>
                                <ActivityActionsMenu
                                  activity={activity}
                                  open={openActivityMenuId === activity.id}
                                  onOpenChange={() =>
                                    setOpenActivityMenuId((current) =>
                                      current === activity.id
                                        ? null
                                        : activity.id,
                                    )
                                  }
                                  onEdit={() => editLeadActivity(activity)}
                                  onComplete={() => {
                                    setOpenActivityMenuId(null);
                                    completeActivity.mutate({
                                      id: lead.id,
                                      activityId: activity.id,
                                    });
                                  }}
                                  onDelete={() => {
                                    setOpenActivityMenuId(null);
                                    setDeleteActivityTarget({
                                      id: activity.id,
                                      title: activity.content,
                                    });
                                  }}
                                />
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                {overdue && (
                                  <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                                    Overdue
                                  </span>
                                )}
                                {!overdue && priority !== "none" && (
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${priority === "high" ? "bg-red-600 text-white" : priority === "medium" ? "bg-yellow-300 text-yellow-950" : "bg-blue-600 text-white"}`}
                                  >
                                    {priority}
                                  </span>
                                )}
                                <span
                                  className={
                                    overdue
                                      ? "text-red-600"
                                      : "text-emerald-600"
                                  }
                                >
                                  {dueDate
                                    ? dueDate.toLocaleString([], {
                                        month: "short",
                                        day: "numeric",
                                        hour: "numeric",
                                        minute: "2-digit",
                                      })
                                    : "No due date"}
                                </span>
                                <span>· {lead.owner?.name || "Workspace"}</span>
                                {lead.contact?.name && (
                                  <span className="flex items-center gap-1">
                                    <UserRound className="h-3.5 w-3.5" />
                                    {lead.contact.name}
                                  </span>
                                )}
                                {(lead.account?.name || lead.company) && (
                                  <span className="flex items-center gap-1">
                                    <Building2 className="h-3.5 w-3.5" />
                                    {lead.account?.name || lead.company}
                                  </span>
                                )}
                              </div>
                            </div>
                            {description && (
                              <div className="border-t border-amber-200 bg-amber-50/80 px-4 py-2 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
                                {description}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              ) : (
                <ActivityWorkspaceEmpty
                  title="No focus items yet"
                  description="Scheduled activities, pinned notes, and follow-ups will appear here."
                />
              )}
            </section>

            <section className="px-1">
              <ActivityWorkspaceSectionHeader title="History" />
              <div className="mt-4">
                <ActivityWorkspaceHistoryFilters
                  filters={[
                    { id: "all", label: "All" },
                    {
                      id: "activities",
                      label: "Activities",
                      count: historyItems.filter((item) => item.type !== "note")
                        .length,
                    },
                    {
                      id: "notes",
                      label: "Notes",
                      count: historyItems.filter((item) => item.type === "note")
                        .length,
                    },
                    {
                      id: "files",
                      label: "Files",
                      count: fileHistoryItems.length,
                    },
                  ]}
                  active={historyFilter}
                  onChange={setHistoryFilter}
                />
                <div className="relative">
                  {visibleFileHistoryItems.map((item) => (
                    <div
                      key={`file-${item.id}`}
                      className="relative flex gap-3 pb-4 pl-1 before:absolute before:left-5 before:top-10 before:h-[calc(100%-20px)] before:border-l before:border-dashed before:border-border last:before:hidden"
                    >
                      <span className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </span>
                      <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 shadow-sm">
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${item.mimeType === "application/pdf" ? "bg-red-50 text-red-600 dark:bg-red-950/40" : "bg-blue-50 text-blue-600 dark:bg-blue-950/40"}`}
                        >
                          <FileText className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          {item.fileKey ? (
                            <a
                              href={storageApi.getProxyFileUrl(item.fileKey)}
                              target="_blank"
                              rel="noreferrer"
                              className="block truncate text-sm font-semibold text-primary hover:underline"
                            >
                              {item.fileName || item.title}
                            </a>
                          ) : (
                            <span className="block truncate text-sm font-semibold">
                              {item.fileName || item.title}
                            </span>
                          )}
                          <span className="mt-1 block truncate text-xs text-muted-foreground">
                            {formatHistoryDate(item.createdAt)} ·{" "}
                            {item.author || "Web App"} ·{" "}
                            {formatFileSize(item.size)}
                          </span>
                          {item.content && (
                            <span className="mt-1 block text-xs text-foreground">
                              {item.content}
                            </span>
                          )}
                        </span>
                        <div className="relative shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() =>
                              setOpenActivityMenuId((current) =>
                                current === `file-${item.id}`
                                  ? null
                                  : `file-${item.id}`,
                              )
                            }
                            aria-label={`More actions for ${item.fileName || item.title}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          {openActivityMenuId === `file-${item.id}` && (
                            <div className="absolute right-0 top-8 z-50 w-48 rounded-lg border border-border bg-popover p-1.5 shadow-xl">
                              <button
                                type="button"
                                onClick={() => openFileDescription(item)}
                                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                              >
                                <AlignLeft className="h-4 w-4" />
                                Add description
                              </button>
                              {item.fileKey && (
                                <a
                                  href={storageApi.getProxyFileUrl(
                                    item.fileKey,
                                  )}
                                  download={item.fileName || item.title}
                                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                                >
                                  <Save className="h-4 w-4" />
                                  Download
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActivityMenuId(null);
                                  setDeleteFileTarget(item);
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {history.map((activity) => {
                    const activityKind = String(
                      activity.customFields?.activityType || activity.category,
                    );
                    const isNote = activity.type === "note";
                    const ActivityIcon = isNote
                      ? StickyNote
                      : activityKind === "call"
                        ? Phone
                        : activityKind === "meeting"
                          ? Users
                          : activityKind === "deadline"
                            ? Flag
                            : activityKind === "lunch"
                              ? Utensils
                              : CheckSquare;
                    const description =
                      typeof activity.customFields?.description === "string"
                        ? activity.customFields.description
                            .replace(/<[^>]+>/g, " ")
                            .replace(/\s+/g, " ")
                            .trim()
                        : "";
                    return (
                      <div
                        key={activity.id}
                        className="relative flex gap-3 pb-4 pl-1 before:absolute before:left-5 before:top-10 before:h-[calc(100%-20px)] before:border-l before:border-dashed before:border-border last:before:hidden"
                      >
                        <span className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background">
                          <ActivityIcon className="h-4 w-4 text-muted-foreground" />
                        </span>
                        <div
                          className={`min-w-0 flex-1 overflow-visible rounded-xl border shadow-sm ${isNote ? "border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/20" : "border-border bg-background"}`}
                        >
                          <div className="px-4 py-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                {!isNote && (
                                  <span
                                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${activity.completedAt ? "bg-emerald-600 text-white" : "border border-muted-foreground/40"}`}
                                  >
                                    {activity.completedAt && (
                                      <Check className="h-3 w-3" />
                                    )}
                                  </span>
                                )}
                                {isNote ? (
                                  <div
                                    className="min-w-0 truncate font-semibold [&_a]:text-primary [&_a]:underline"
                                    dangerouslySetInnerHTML={{
                                      __html: sanitizeNoteHtml(
                                        activity.content,
                                      ),
                                    }}
                                  />
                                ) : (
                                  <p className="truncate font-semibold">
                                    {activity.content}
                                  </p>
                                )}
                              </div>
                              <ActivityActionsMenu
                                activity={activity}
                                open={openActivityMenuId === activity.id}
                                onOpenChange={() =>
                                  setOpenActivityMenuId((current) =>
                                    current === activity.id
                                      ? null
                                      : activity.id,
                                  )
                                }
                                onEdit={
                                  isNote
                                    ? undefined
                                    : () => editLeadActivity(activity)
                                }
                                onComplete={
                                  isNote || activity.completedAt
                                    ? undefined
                                    : () => {
                                        setOpenActivityMenuId(null);
                                        completeActivity.mutate({
                                          id: lead.id,
                                          activityId: activity.id,
                                        });
                                      }
                                }
                                onDelete={() => {
                                  setOpenActivityMenuId(null);
                                  setDeleteActivityTarget({
                                    id: activity.id,
                                    title: activity.content,
                                  });
                                }}
                              />
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>
                                {new Date(
                                  activity.completedAt || activity.createdAt,
                                ).toLocaleString()}
                              </span>
                              <span>· {lead.owner?.name || "Workspace"}</span>
                              {lead.contact?.name && (
                                <span className="flex items-center gap-1">
                                  <UserRound className="h-3.5 w-3.5" />
                                  {lead.contact.name}
                                </span>
                              )}
                              {(lead.account?.name || lead.company) && (
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3.5 w-3.5" />
                                  {lead.account?.name || lead.company}
                                </span>
                              )}
                            </div>
                          </div>
                          {description && !isNote && (
                            <div className="border-t border-amber-200 bg-amber-50/80 px-4 py-2 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
                              {description}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {!history.length && !visibleFileHistoryItems.length && (
                    <ActivityWorkspaceEmpty
                      title="No history yet"
                      description="Lead notes, activities, and files will appear here."
                    />
                  )}
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
      <Dialog
        open={Boolean(editingActivity)}
        onOpenChange={(open) => {
          if (!open) setEditingActivity(null);
        }}
      >
        <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-6xl gap-0 overflow-y-auto p-0">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle>Edit activity</DialogTitle>
          </DialogHeader>
          {editingActivity && (
            <LeadActivityComposer
              key={editingActivity.id}
              activity={editingActivity}
              activities={lead.activities}
              contactName={lead.contact?.name}
              companyName={lead.account?.name || lead.company}
              saving={updateActivity.isPending || completeActivity.isPending}
              onCancel={() => setEditingActivity(null)}
              onSave={scheduleActivity}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(fileDescriptionTarget)}
        onOpenChange={(open) => {
          if (!open) setFileDescriptionTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add file description</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="truncate text-sm font-medium">
              {fileDescriptionTarget?.fileName || fileDescriptionTarget?.title}
            </p>
            <textarea
              autoFocus
              value={fileDescription}
              onChange={(event) => setFileDescription(event.target.value)}
              rows={5}
              maxLength={20000}
              placeholder="Add a description…"
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFileDescriptionTarget(null)}
                disabled={savingFileDescription}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void saveFileDescription()}
                disabled={savingFileDescription}
              >
                {savingFileDescription && (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                )}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <DeleteConfirmDialog
        isOpen={Boolean(deleteActivityTarget)}
        onClose={() => setDeleteActivityTarget(null)}
        onConfirm={() => void removeLeadActivity()}
        title="Delete Activity"
        itemName={deleteActivityTarget?.title}
        isDeleting={deleteActivity.isPending}
      />
      <DeleteConfirmDialog
        isOpen={Boolean(deleteFileTarget)}
        onClose={() => setDeleteFileTarget(null)}
        onConfirm={() => void removeLeadFile()}
        title="Delete File"
        itemName={deleteFileTarget?.fileName || deleteFileTarget?.title}
        isDeleting={deletingFile}
      />
    </div>
  );
}

function ActivityActionsMenu({
  activity,
  open,
  onOpenChange,
  onEdit,
  onComplete,
  onDelete,
}: {
  activity: CrmRecord["activities"][number];
  open: boolean;
  onOpenChange: () => void;
  onEdit?: () => void;
  onComplete?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="relative shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={onOpenChange}
        aria-label={`More actions for ${activity.content}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-8 z-50 w-44 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
        >
          {onEdit && (
            <button
              type="button"
              role="menuitem"
              onClick={onEdit}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          )}
          {onComplete && (
            <button
              type="button"
              role="menuitem"
              onClick={onComplete}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <Check className="h-4 w-4" />
              Mark as done
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={onDelete}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function LeadSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ContactMethodEditor({
  type,
  value,
  methodType,
  onValueChange,
  onTypeChange,
}: {
  type: "tel" | "email";
  value: string;
  methodType: "work" | "home" | "mobile" | "other";
  onValueChange: (value: string) => void;
  onTypeChange: (value: "work" | "home" | "mobile" | "other") => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-2">
      <Input
        autoFocus
        type={type}
        value={value}
        placeholder={type === "tel" ? "Phone" : "Email"}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <Select value={methodType} onValueChange={onTypeChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="work">Work</SelectItem>
          <SelectItem value="home">Home</SelectItem>
          {type === "tel" ? (
            <SelectItem value="mobile">Mobile</SelectItem>
          ) : null}
          <SelectItem value="other">Other</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function LeadActivityComposer({
  activity,
  activities,
  contactName,
  companyName,
  saving,
  onCancel,
  onSave,
}: {
  activity?: CrmRecord["activities"][number];
  activities: Array<{
    id: string;
    type: "note" | "status" | "planned" | "message";
    content: string;
    dueAt: string | null;
    durationMinutes?: number;
  }>;
  contactName?: string;
  companyName?: string;
  saving: boolean;
  onCancel: () => void;
  onSave: (draft: LeadActivityDraft) => Promise<void>;
}) {
  const { user } = useAuth();
  const descriptionRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef(0);
  const [timelineInteraction, setTimelineInteraction] = useState<
    "move" | "resize-start" | "resize-end" | null
  >(null);
  const initialStart = useMemo(() => {
    if (activity?.dueAt) return new Date(activity.dueAt);
    const date = new Date();
    date.setMinutes(date.getMinutes() < 30 ? 30 : 60, 0, 0);
    return date;
  }, [activity]);
  const initialEnd = useMemo(() => {
    const customEnd = activity?.customFields?.endAt;
    if (typeof customEnd === "string") return new Date(customEnd);
    return new Date(
      initialStart.getTime() + (activity?.durationMinutes || 60) * 60 * 1000,
    );
  }, [activity, initialStart]);
  const localDate = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const localTime = (date: Date) =>
    `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const [title, setTitle] = useState(activity?.content || "Meeting");
  const [kind, setKind] = useState<LeadActivityKind>(
    (activity?.customFields?.activityType as LeadActivityKind) ||
      (activity?.category === "call"
        ? "call"
        : activity?.category === "meeting"
          ? "meeting"
          : "task"),
  );
  const [startDate, setStartDate] = useState(localDate(initialStart));
  const [startTime, setStartTime] = useState(localTime(initialStart));
  const [endDate, setEndDate] = useState(localDate(initialEnd));
  const [endTime, setEndTime] = useState(localTime(initialEnd));
  const [priority, setPriority] = useState<"none" | "low" | "medium" | "high">(
    (activity?.customFields?.priority as "none" | "low" | "medium" | "high") ||
      "none",
  );
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [description, setDescription] = useState(
    String(activity?.customFields?.description || ""),
  );
  const [location, setLocation] = useState(
    String(activity?.customFields?.location || ""),
  );
  const [videoCallUrl, setVideoCallUrl] = useState(
    String(activity?.customFields?.videoCallUrl || ""),
  );
  const [showLocation, setShowLocation] = useState(
    Boolean(activity?.customFields?.location),
  );
  const [showVideoCall, setShowVideoCall] = useState(
    Boolean(activity?.customFields?.videoCallUrl),
  );
  const [availability, setAvailability] = useState<"free" | "busy">(
    activity?.customFields?.availability === "busy" ? "busy" : "free",
  );
  const [markDone, setMarkDone] = useState(Boolean(activity?.completedAt));
  const activityTypes = [
    { id: "call" as const, label: "Call", icon: Phone },
    { id: "meeting" as const, label: "Meeting", icon: Users },
    { id: "task" as const, label: "Task", icon: CheckSquare },
    { id: "deadline" as const, label: "Deadline", icon: Flag },
    { id: "lunch" as const, label: "Lunch", icon: Utensils },
  ];
  const startAt = new Date(`${startDate}T${startTime}`);
  const endAt = new Date(`${endDate}T${endTime}`);
  const durationMinutes = Math.max(
    15,
    Math.round((endAt.getTime() - startAt.getTime()) / 60000) || 60,
  );
  const previewTop =
    Math.max(0, Math.min(24, startAt.getHours() + startAt.getMinutes() / 60)) *
    48;
  const previewHeight = Math.max(
    28,
    Math.min(24 * 48 - previewTop, (durationMinutes / 60) * 48),
  );
  const dayActivities = activities.filter(
    (activity) =>
      activity.type === "planned" &&
      activity.dueAt &&
      new Date(activity.dueAt).toDateString() === startAt.toDateString(),
  );

  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = Math.max(
        0,
        (initialStart.getHours() - 2) * 48,
      );
    }
    if (descriptionRef.current) {
      descriptionRef.current.innerHTML = String(
        activity?.customFields?.description || "",
      );
    }
  }, [activity?.customFields, initialStart]);

  const shiftDay = (amount: number) => {
    const nextStart = new Date(startAt);
    const nextEnd = new Date(endAt);
    nextStart.setDate(nextStart.getDate() + amount);
    nextEnd.setDate(nextEnd.getDate() + amount);
    setStartDate(localDate(nextStart));
    setEndDate(localDate(nextEnd));
  };
  const formatDescription = (
    command: "bold" | "italic" | "underline" | "insertUnorderedList",
  ) => {
    descriptionRef.current?.focus();
    document.execCommand(command, false);
    setDescription(descriptionRef.current?.innerHTML || "");
  };
  const save = async () => {
    if (
      !title.trim() ||
      Number.isNaN(startAt.getTime()) ||
      Number.isNaN(endAt.getTime()) ||
      endAt <= startAt
    ) {
      toast.error("Enter a title and a valid activity time range");
      return;
    }
    await onSave({
      title: title.trim(),
      startAt,
      endAt,
      kind,
      priority,
      description: descriptionRef.current?.innerHTML || description,
      location,
      videoCallUrl,
      availability,
      markDone,
    });
  };
  const handleTimelinePointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!timelineInteraction || !timelineRef.current) return;
    const timelineRect = timelineRef.current.getBoundingClientRect();
    const pointerY =
      event.clientY - timelineRect.top + timelineRef.current.scrollTop;
    const pointerMinutes = Math.round(((pointerY / 48) * 60) / 15) * 15;
    if (timelineInteraction === "resize-start") {
      const endMinutes =
        endAt.toDateString() === startAt.toDateString()
          ? endAt.getHours() * 60 + endAt.getMinutes()
          : 24 * 60;
      const nextMinutes = Math.max(
        0,
        Math.min(endMinutes - 15, pointerMinutes),
      );
      const nextStart = new Date(`${startDate}T00:00`);
      nextStart.setMinutes(nextMinutes);
      setStartTime(localTime(nextStart));
      return;
    }
    if (timelineInteraction === "resize-end") {
      const startMinutes = startAt.getHours() * 60 + startAt.getMinutes();
      const nextMinutes = Math.max(
        startMinutes + 15,
        Math.min(24 * 60, pointerMinutes),
      );
      const nextEnd = new Date(`${startDate}T00:00`);
      nextEnd.setMinutes(nextMinutes);
      setEndDate(localDate(nextEnd));
      setEndTime(localTime(nextEnd));
      return;
    }
    const rawY = pointerY - dragOffsetRef.current;
    const snappedMinutes = Math.round(((rawY / 48) * 60) / 15) * 15;
    const nextMinutes = Math.max(
      0,
      Math.min(24 * 60 - durationMinutes, snappedMinutes),
    );
    const nextStart = new Date(`${startDate}T00:00`);
    nextStart.setMinutes(nextMinutes);
    const nextEnd = new Date(nextStart.getTime() + durationMinutes * 60000);
    setStartTime(localTime(nextStart));
    setEndDate(localDate(nextEnd));
    setEndTime(localTime(nextEnd));
  };

  return (
    <div className="grid overflow-hidden lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-4 p-4">
        <Input
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Activity title"
          className="h-11 text-xl"
        />
        <div className="flex flex-wrap gap-2">
          {activityTypes.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              type="button"
              variant={kind === id ? "default" : "outline"}
              size="icon-lg"
              onClick={() => {
                const hasDefaultTitle =
                  activityTypes.some((item) => item.label === title) ||
                  !title.trim();
                setKind(id);
                if (hasDefaultTitle) setTitle(label);
              }}
              title={label}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_1fr_1fr] sm:items-center">
          <Input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
          <Input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
          <span className="text-center">–</span>
          <Input
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
          />
          <Input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>
        <div className="relative flex items-center gap-2">
          <Flag className="h-4 w-4 text-muted-foreground" />
          <button
            type="button"
            onClick={() => setPriorityOpen((open) => !open)}
            className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium"
          >
            {priority === "none"
              ? "Priority"
              : priority.charAt(0).toUpperCase() + priority.slice(1)}
            <ChevronDown className="h-4 w-4" />
          </button>
          {priorityOpen && (
            <div className="absolute left-6 top-11 z-40 w-52 rounded-xl border border-border bg-popover p-2 shadow-xl">
              {(["none", "high", "medium", "low"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setPriority(value);
                    setPriorityOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm capitalize hover:bg-muted"
                >
                  {value === "none" ? "No priority" : value}
                  {priority === value && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => setShowLocation((visible) => !visible)}
            className="font-medium text-primary"
          >
            Add Location,
          </button>
          <button
            type="button"
            onClick={() => setShowVideoCall((visible) => !visible)}
            className="font-medium text-primary"
          >
            Video call,
          </button>
          <span className="font-medium text-primary">Description</span>
        </div>
        {showLocation && (
          <div className="relative">
            <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Location"
              className="pl-9"
            />
          </div>
        )}
        {showVideoCall && (
          <div className="relative">
            <Video className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="url"
              value={videoCallUrl}
              onChange={(event) => setVideoCallUrl(event.target.value)}
              placeholder="https://meeting-link.example"
              className="pl-9"
            />
          </div>
        )}
        <Select
          value={availability}
          onValueChange={(value) => setAvailability(value as "free" | "busy")}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="busy">Busy</SelectItem>
          </SelectContent>
        </Select>
        <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/80 shadow-sm ring-1 ring-amber-100/60 dark:border-amber-900/50 dark:bg-amber-950/20 dark:ring-amber-950/40">
          <div
            ref={descriptionRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Add a description…"
            onInput={(event) => setDescription(event.currentTarget.innerHTML)}
            className="min-h-32 p-4 text-sm leading-6 outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
          />
          <div className="flex gap-1 border-t border-amber-200 bg-background/40 px-3 py-2.5 dark:border-amber-900/50">
            {(
              [
                { label: "Bold", icon: Bold, command: "bold" },
                { label: "Italic", icon: Italic, command: "italic" },
                { label: "Underline", icon: Underline, command: "underline" },
                { label: "List", icon: List, command: "insertUnorderedList" },
              ] as const
            ).map(({ label, icon: Icon, command }) => (
              <Button
                key={label}
                type="button"
                variant="ghost"
                size="icon"
                onMouseDown={(event) => {
                  event.preventDefault();
                  formatDescription(command);
                }}
                title={label}
              >
                <Icon className="h-4 w-4" />
              </Button>
            ))}
          </div>
        </div>
        <div className="rounded-md border border-border px-3 py-2 text-sm">
          <UserRound className="mr-2 inline h-4 w-4" />
          {user?.name || user?.email || "You"} (You)
        </div>
        {contactName && (
          <div className="rounded-md border border-border px-3 py-2 text-sm">
            <UserRound className="mr-2 inline h-4 w-4" />
            {contactName}
          </div>
        )}
        {companyName && (
          <div className="rounded-md border border-border px-3 py-2 text-sm">
            <Building2 className="mr-2 inline h-4 w-4" />
            {companyName}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={markDone}
              onChange={(event) => setMarkDone(event.target.checked)}
            />
            Mark as done
          </label>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </div>
      <div className="border-l border-border bg-muted/10">
        <div className="flex items-center justify-between border-b border-border px-3 py-3 text-sm font-semibold">
          <span>
            {startAt.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </span>
          <span className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => shiftDay(-1)}
              title="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => shiftDay(1)}
              title="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </span>
        </div>
        <div
          ref={timelineRef}
          className="relative h-[540px] touch-none overflow-y-auto"
          onPointerMove={handleTimelinePointerMove}
          onPointerUp={() => setTimelineInteraction(null)}
          onPointerCancel={() => setTimelineInteraction(null)}
        >
          <div className="relative h-[1152px]">
            {Array.from({ length: 25 }, (_, index) => (
              <div
                key={index}
                className="absolute left-0 right-0 flex h-12 border-t border-border"
                style={{ top: index * 48 }}
              >
                <span className="w-14 -translate-y-2 bg-background pr-2 text-right text-xs text-muted-foreground">
                  {new Date(2000, 0, 1, index).toLocaleTimeString([], {
                    hour: "numeric",
                  })}
                </span>
              </div>
            ))}
            {dayActivities.map((activity) => {
              const itemStart = new Date(activity.dueAt!);
              const top =
                (itemStart.getHours() + itemStart.getMinutes() / 60) * 48;
              const height = Math.max(
                24,
                ((activity.durationMinutes || 60) / 60) * 48,
              );
              return (
                <div
                  key={activity.id}
                  className="absolute left-16 right-3 overflow-hidden rounded-sm bg-muted px-2 py-1 text-xs font-semibold text-foreground"
                  style={{ top, height }}
                >
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {activity.content}
                  </span>
                </div>
              );
            })}
            <div
              role="slider"
              aria-label="Activity time"
              aria-valuetext={`${startTime} to ${endTime}`}
              tabIndex={0}
              onPointerDown={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                dragOffsetRef.current = event.clientY - rect.top;
                event.currentTarget.setPointerCapture(event.pointerId);
                setTimelineInteraction("move");
              }}
              onKeyDown={(event) => {
                if (event.key !== "ArrowUp" && event.key !== "ArrowDown")
                  return;
                event.preventDefault();
                const amount = event.key === "ArrowUp" ? -15 : 15;
                const nextStart = new Date(startAt.getTime() + amount * 60000);
                const nextEnd = new Date(endAt.getTime() + amount * 60000);
                if (
                  nextStart.toDateString() !== startAt.toDateString() ||
                  nextEnd.toDateString() !== endAt.toDateString()
                )
                  return;
                setStartTime(localTime(nextStart));
                setEndTime(localTime(nextEnd));
              }}
              className={`absolute left-16 right-3 z-10 select-none overflow-hidden rounded-sm bg-blue-600 px-2 py-1 text-xs font-semibold text-white shadow-sm ${timelineInteraction === "move" ? "cursor-grabbing ring-2 ring-blue-300" : timelineInteraction ? "ring-2 ring-blue-300" : "cursor-grab"}`}
              style={{ top: previewTop, height: previewHeight }}
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
                {kind === "call" ? (
                  <Phone className="h-3.5 w-3.5" />
                ) : (
                  <Users className="h-3.5 w-3.5" />
                )}
                {title || "Activity"}
              </span>
              <span className="mt-0.5 block font-normal">
                {startAt.toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                →{" "}
                {endAt.toLocaleTimeString([], {
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

function LabelBadgeList({ labels }: { labels: string[] }) {
  if (!labels.length) return <span>No labels</span>;
  let labelColors: Record<string, string> = {};
  try {
    labelColors = JSON.parse(
      window.localStorage.getItem("contact-label-colors") || "{}",
    );
  } catch {
    labelColors = {};
  }
  const fallbackColors = [
    "bg-red-500 text-white",
    "bg-emerald-300 text-emerald-950",
    "bg-yellow-300 text-yellow-950",
    "bg-blue-600 text-white",
    "bg-violet-500 text-white",
    "bg-cyan-300 text-cyan-950",
  ];
  const badgeClass = (label: string) =>
    LABEL_SWATCHES.find((swatch) => swatch.id === labelColors[label])?.badge ||
    fallbackColors[
      Math.abs(
        [...label].reduce(
          (total, character) => total + character.charCodeAt(0),
          0,
        ),
      ) % fallbackColors.length
    ];

  return (
    <span className="flex flex-wrap gap-1">
      {labels.map((label) => (
        <span
          key={label}
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${badgeClass(label)}`}
        >
          {label}
        </span>
      ))}
    </span>
  );
}

function CustomLabelEditor({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] =
    useState<(typeof LABEL_SWATCHES)[number]["id"]>("blue");
  const [labelColors, setLabelColors] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(
        window.localStorage.getItem("contact-label-colors") || "{}",
      );
    } catch {
      return {};
    }
  });
  const selected = value
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
  const availableLabels = Array.from(new Set([...options, ...selected])).filter(
    (label) => label.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const fallbackColors = [
    "bg-red-500 text-white",
    "bg-emerald-300 text-emerald-950",
    "bg-yellow-300 text-yellow-950",
    "bg-blue-600 text-white",
    "bg-violet-500 text-white",
    "bg-cyan-300 text-cyan-950",
  ];
  const badgeClass = (label: string) =>
    LABEL_SWATCHES.find((swatch) => swatch.id === labelColors[label])?.badge ||
    fallbackColors[
      Math.abs(
        [...label].reduce(
          (total, character) => total + character.charCodeAt(0),
          0,
        ),
      ) % fallbackColors.length
    ];
  const updateSelected = (labels: string[]) => onChange(labels.join(", "));
  const addCustomLabel = () => {
    const label = newLabelName.trim();
    if (!label) return;
    const nextColors = { ...labelColors, [label]: newLabelColor };
    setLabelColors(nextColors);
    window.localStorage.setItem(
      "contact-label-colors",
      JSON.stringify(nextColors),
    );
    updateSelected(Array.from(new Set([...selected, label])));
    setSearch("");
    setNewLabelName("");
    setCreating(false);
  };

  return (
    <div className="overflow-hidden rounded-md border border-input bg-background">
      <div className="flex min-h-10 items-center justify-between gap-2 px-3 py-2">
        <div className="flex min-w-0 flex-wrap gap-1">
          {selected.length ? (
            selected.map((label) => (
              <span
                key={label}
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${badgeClass(label)}`}
              >
                {label}
              </span>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">Add labels</span>
          )}
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 rotate-180 text-muted-foreground" />
      </div>

      {creating ? (
        <div className="space-y-4 border-t p-3">
          <div className="space-y-1.5">
            <Label>Label name</Label>
            <Input
              autoFocus
              value={newLabelName}
              onChange={(event) => setNewLabelName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomLabel();
                }
              }}
              maxLength={40}
              placeholder="Label name"
            />
          </div>
          <div className="space-y-2">
            <Label>Label color</Label>
            <div className="flex flex-wrap gap-2">
              {LABEL_SWATCHES.map((swatch) => (
                <button
                  key={swatch.id}
                  type="button"
                  onClick={() => setNewLabelColor(swatch.id)}
                  className={`flex h-7 w-7 items-center justify-center rounded-full ${swatch.dot} ${newLabelColor === swatch.id ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  aria-label={`${swatch.id} label color`}
                >
                  {newLabelColor === swatch.id && (
                    <Check className="h-4 w-4 text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreating(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={addCustomLabel}
              disabled={!newLabelName.trim()}
            >
              Add
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative border-t p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search for labels"
              className="h-9 pl-8"
            />
          </div>
          <div className="max-h-36 overflow-y-auto border-y px-2 py-1.5">
            {availableLabels.map((label) => {
              const isSelected = selected.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() =>
                    updateSelected(
                      isSelected
                        ? selected.filter((item) => item !== label)
                        : [...selected, label],
                    )
                  }
                  className="flex w-full items-center justify-between rounded-md px-1.5 py-2 text-left hover:bg-muted"
                >
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${badgeClass(label)}`}
                  >
                    {label}
                  </span>
                  {isSelected && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
            {availableLabels.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                No matching labels
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setNewLabelName(search.trim());
              setNewLabelColor("blue");
              setCreating(true);
            }}
            className="flex w-full items-center gap-2 px-3 py-3 text-sm font-medium text-primary hover:bg-muted"
          >
            <Plus className="h-4 w-4" />
            Add label
          </button>
        </>
      )}
    </div>
  );
}

function EditableDetail({
  icon: Icon,
  field,
  label,
  value,
  displayValue,
  rawValue,
  editingField,
  editValue,
  onBegin,
  onChange,
  onSave,
  onCancel,
  saving,
  inputType = "text",
  placeholder,
  disabled = false,
  editor,
}: {
  icon: typeof UserRound;
  field: EditableLeadField;
  label: string;
  value: string;
  displayValue?: ReactNode;
  rawValue: string;
  editingField: EditableLeadField | null;
  editValue: string;
  onBegin: (field: EditableLeadField, value: string) => void;
  onChange: (value: string) => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  inputType?: string;
  placeholder?: string;
  disabled?: boolean;
  editor?: ReactNode;
}) {
  const editing = editingField === field;
  return (
    <div
      className={`rounded-lg px-2 py-2 transition-colors ${editing ? "bg-muted/60" : "group hover:bg-muted/40"}`}
    >
      {editing ? (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          {editor || (
            <Input
              autoFocus
              type={inputType}
              value={editValue}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onSave();
                }
                if (event.key === "Escape") onCancel();
              }}
              placeholder={placeholder}
              min={inputType === "number" ? "0" : undefined}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void onSave()}
              disabled={saving || (field === "title" && !editValue.trim())}
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => !disabled && onBegin(field, rawValue)}
          disabled={disabled}
          className="flex w-full items-start gap-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60"
          title={
            disabled
              ? `Link a ${field === "phone" || field === "email" || field === "contactLabels" ? "contact" : "organization"} to edit ${label.toLowerCase()}`
              : `Edit ${label.toLowerCase()}`
          }
        >
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block min-w-0 font-medium">
              {displayValue ?? value}
            </span>
            <span className="block text-xs text-muted-foreground">{label}</span>
          </span>
          {!disabled && (
            <Pencil className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </button>
      )}
    </div>
  );
}
