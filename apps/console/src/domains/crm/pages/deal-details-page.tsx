import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Building2,
  CalendarDays,
  Check,
  CircleDollarSign,
  Download,
  FileText,
  Loader2,
  Mail,
  MoreHorizontal,
  Pencil,
  Pin,
  Phone,
  StickyNote,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Textarea } from "@/shared/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { DeleteConfirmDialog } from "@/shared/components/delete-confirm-dialog";
import { LabelBadge } from "@/shared/components/label-editor";
import { WhatsAppIcon } from "@/shared/ui/channel-icon";
import {
  useContactOwners,
  useContacts,
} from "@/domains/contacts/hooks/use-contacts";
import { toContactViewModel } from "@/domains/contacts/types/types";
import { EmailComposer } from "@/domains/contacts/pages/contact-details-page";
import { storageApi } from "@/shared/lib/storage.api";
import {
  ActivityWorkspaceComposer,
  ActivityWorkspaceEmpty,
  ActivityWorkspaceHistoryFilters,
  ActivityWorkspaceSectionHeader,
  type ActivityWorkspaceTab,
} from "../components/activity-workspace-ui";
import { DealFileWorkspace } from "../components/deal-file-workspace";
import { DealDialog } from "../components/deal-dialog";
import {
  LeadActivityComposer,
  type LeadActivityDraft,
} from "./lead-details-page";
import {
  useAddCrmRecordActivity,
  useCompleteCrmRecordActivity,
  useDeleteCrmRecord,
  useDeleteCrmRecordActivity,
  useCrmRecords,
  useSalesPipeline,
  useUpdateCrmRecordActivity,
  useUpdateCrmRecordNote,
  useUpdateCrmRecordStage,
} from "../hooks/use-crm-records";
import type { CrmRecord } from "../types/types";

type DealActivity = CrmRecord["activities"][number];
type HistoryFilter = "all" | "activities" | "notes" | "files" | "documents";

const attachmentKind = (activity: DealActivity) => {
  const value = activity.customFields?.attachmentKind;
  return value === "file" || value === "document" ? value : null;
};

const attachmentValue = (activity: DealActivity, key: string) => {
  const value = activity.customFields?.[key];
  return typeof value === "string" ? value : "";
};

const money = (value: number, currency: CrmRecord["currency"]) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not set";

const activityIcon = (activity: DealActivity) => {
  if (attachmentKind(activity)) return FileText;
  const kind = String(
    activity.customFields?.activityType || activity.category || "task",
  );
  if (activity.type === "note") return StickyNote;
  if (kind === "call") return Phone;
  if (kind === "meeting") return Users;
  if (kind === "email") return Mail;
  return CalendarDays;
};

export function DealDetailsPage() {
  const navigate = useNavigate();
  const { dealId } = useParams<{ dealId: string }>();
  const { data: deals = [], isLoading } = useCrmRecords();
  const { data: contacts = [] } = useContacts();
  const { data: owners = [] } = useContactOwners();
  const { data: pipeline, isLoading: pipelineLoading } = useSalesPipeline();
  const updateStage = useUpdateCrmRecordStage();
  const addActivity = useAddCrmRecordActivity();
  const completeActivity = useCompleteCrmRecordActivity();
  const updateActivity = useUpdateCrmRecordActivity();
  const deleteActivity = useDeleteCrmRecordActivity();
  const updateNote = useUpdateCrmRecordNote();
  const deleteDeal = useDeleteCrmRecord();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [tab, setTab] = useState<ActivityWorkspaceTab>("activity");
  const [activityComposerOpen, setActivityComposerOpen] = useState(true);
  const [note, setNote] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [deleteActivityTarget, setDeleteActivityTarget] =
    useState<DealActivity | null>(null);
  const [editingActivity, setEditingActivity] = useState<DealActivity | null>(
    null,
  );
  const [fileDescriptionTarget, setFileDescriptionTarget] =
    useState<DealActivity | null>(null);
  const [fileDescription, setFileDescription] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [openFocusMenuId, setOpenFocusMenuId] = useState<string | null>(null);
  const [currentTime] = useState(() => Date.now());

  const deal = deals.find((item) => item.id === dealId);
  const linkedContactItem = contacts.find(
    (item) => item.id === deal?.contact?.id,
  );
  const linkedContact = linkedContactItem
    ? toContactViewModel(linkedContactItem)
    : null;
  const stages = pipeline?.stages || [];
  const currentStageIndex = stages.findIndex(
    (stage) => stage.id === deal?.stage,
  );
  const currentStage = stages[currentStageIndex];
  const wonStage = stages.find((stage) => stage.type === "won");
  const lostStage = stages.find((stage) => stage.type === "lost");
  const planned = useMemo(
    () =>
      (deal?.activities || [])
        .filter(
          (activity) => activity.type === "planned" && !activity.completedAt,
        )
        .sort(
          (left, right) =>
            new Date(left.dueAt || 0).getTime() -
            new Date(right.dueAt || 0).getTime(),
        ),
    [deal?.activities],
  );
  const focusItems = useMemo(
    () =>
      [
        ...planned,
        ...(deal?.activities || []).filter(
          (activity) =>
            activity.type === "note" &&
            !attachmentKind(activity) &&
            activity.customFields?.pinned === true,
        ),
      ].sort((left, right) => {
        const leftDate = left.dueAt || left.createdAt;
        const rightDate = right.dueAt || right.createdAt;
        return new Date(leftDate).getTime() - new Date(rightDate).getTime();
      }),
    [deal?.activities, planned],
  );
  const history = useMemo(() => {
    const items = (deal?.activities || [])
      .filter((item) => item.type !== "planned" || Boolean(item.completedAt))
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      );
    if (historyFilter === "notes") {
      return items.filter(
        (item) => item.type === "note" && !attachmentKind(item),
      );
    }
    if (historyFilter === "activities") {
      return items.filter((item) => item.type !== "note");
    }
    if (historyFilter === "files")
      return items.filter((item) => attachmentKind(item) === "file");
    if (historyFilter === "documents")
      return items.filter((item) => attachmentKind(item) === "document");
    return items;
  }, [historyFilter, deal?.activities]);

  const changeStage = async (stage: string) => {
    if (!deal || stage === deal.stage) return;
    try {
      await updateStage.mutateAsync({ id: deal.id, stage });
      toast.success(
        `Deal moved to ${stages.find((item) => item.id === stage)?.label || "stage"}`,
      );
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to change stage",
      );
    }
  };

  const saveActivity = async (draft: LeadActivityDraft) => {
    if (!deal) return;
    const category: "call" | "meeting" | "todo" =
      draft.kind === "call"
        ? "call"
        : draft.kind === "meeting"
          ? "meeting"
          : "todo";
    try {
      const payload = {
        content: draft.title,
        category,
        dueAt: draft.startAt.toISOString(),
        durationMinutes: Math.max(
          15,
          Math.round(
            (draft.endAt.getTime() - draft.startAt.getTime()) / 60_000,
          ),
        ),
        customFields: {
          activityType: draft.kind,
          priority: draft.priority,
          description: draft.description,
          location: draft.location,
          videoCallUrl: draft.videoCallUrl,
          availability: draft.availability,
          endAt: draft.endAt.toISOString(),
        },
      };
      const saved = editingActivity
        ? (await updateActivity.mutateAsync({
            id: deal.id,
            activityId: editingActivity.id,
            payload,
          }),
          editingActivity)
        : await addActivity.mutateAsync({ id: deal.id, ...payload });
      if (draft.markDone && !saved.completedAt) {
        await completeActivity.mutateAsync({
          id: deal.id,
          activityId: saved.id,
        });
      }
      setActivityComposerOpen(false);
      setEditingActivity(null);
      toast.success(editingActivity ? "Activity updated" : "Activity saved");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save activity",
      );
    }
  };

  const saveFileDescription = async () => {
    if (!deal || !fileDescriptionTarget) return;
    try {
      await updateActivity.mutateAsync({
        id: deal.id,
        activityId: fileDescriptionTarget.id,
        payload: {
          customFields: {
            ...fileDescriptionTarget.customFields,
            description: fileDescription.trim(),
          },
        },
      });
      setFileDescriptionTarget(null);
      toast.success("File description updated");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update file description",
      );
    }
  };

  const toggleNotePin = async (activity: DealActivity) => {
    if (!deal) return;
    const pinned = activity.customFields?.pinned !== true;
    try {
      await updateActivity.mutateAsync({
        id: deal.id,
        activityId: activity.id,
        payload: {
          customFields: { ...activity.customFields, pinned },
        },
      });
      toast.success(pinned ? "Note pinned to focus" : "Note unpinned");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update note",
      );
    }
  };

  const saveNote = async () => {
    if (!deal || !note.trim()) return;
    try {
      if (editingNoteId) {
        await updateNote.mutateAsync({
          id: deal.id,
          activityId: editingNoteId,
          content: note.trim(),
        });
      } else {
        await addActivity.mutateAsync({
          id: deal.id,
          content: note.trim(),
        });
      }
      setNote("");
      setEditingNoteId(null);
      toast.success(editingNoteId ? "Note updated" : "Note added");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save note",
      );
    }
  };

  if (isLoading || pipelineLoading) {
    return (
      <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground">
        Loading deal…
      </div>
    );
  }

  if (!deal) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <h1 className="text-lg font-semibold">Deal not found</h1>
          <Button
            className="mt-5"
            onClick={() => navigate("/dashboard/crm/pipeline")}
          >
            Back to deals
          </Button>
        </CardContent>
      </Card>
    );
  }

  const ownerName = deal.owner?.name || "Unassigned";
  const organizationName =
    deal.account?.name || deal.company || deal.contact?.company || "Not linked";

  return (
    <div className="-m-4 flex min-h-[calc(100dvh-4rem)] flex-col bg-background sm:-m-6">
      <header className="border-b bg-background px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="min-w-0 truncate text-2xl font-medium tracking-tight">
            {deal.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-2 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                <UserRound className="h-5 w-5 text-muted-foreground" />
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-semibold">{ownerName}</span>
                <span className="block text-xs text-muted-foreground">
                  Owner
                </span>
              </span>
            </div>
            {wonStage && (
              <Button
                size="sm"
                onClick={() => void changeStage(wonStage.id)}
                disabled={updateStage.isPending}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Won
              </Button>
            )}
            {lostStage && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void changeStage(lostStage.id)}
                disabled={updateStage.isPending}
              >
                Lost
              </Button>
            )}
            <Button
              size="icon-sm"
              variant="outline"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <div className="relative">
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => setActionsOpen((value) => !value)}
                aria-label="More deal actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              {actionsOpen && (
                <div className="absolute right-0 top-10 z-50 w-40 rounded-lg border bg-popover p-1.5 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setActionsOpen(false);
                      setDeleteOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" /> Delete deal
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg bg-muted/70 p-0.5">
          <div className="flex w-full items-center">
            {stages.map((stage, index) => (
              <button
                key={stage.id}
                type="button"
                onClick={() => void changeStage(stage.id)}
                disabled={updateStage.isPending}
                style={{
                  clipPath:
                    index === 0
                      ? "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)"
                      : "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)",
                }}
                className={`relative min-w-0 flex-1 truncate py-2 pl-4 pr-5 text-[11px] font-medium transition-colors first:pl-2 ${index > 0 ? "-ml-2.5" : ""} ${
                  index <= currentStageIndex
                    ? "z-10 bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
                title={stage.label}
              >
                <span className="block truncate">{stage.label}</span>
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/dashboard/crm/pipeline")}
          className="mt-3 text-xs font-medium text-primary hover:underline"
        >
          Sales pipeline&nbsp;&nbsp;→&nbsp;&nbsp;
          {currentStage?.label || deal.stage}
        </button>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-r bg-background lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto">
          <DealSection title="Summary">
            <DetailRow
              icon={CircleDollarSign}
              value={money(deal.value, deal.currency)}
            />
            <DetailRow icon={Building2} value={organizationName} />
            <DetailRow
              icon={UserRound}
              value={deal.contact?.name || "Not linked"}
            />
            <div className="flex items-start gap-3 py-1.5">
              <span className="mt-0.5 w-4 shrink-0" />
              <div className="flex flex-wrap gap-1">
                {deal.labels.length ? (
                  deal.labels.map((label) => (
                    <LabelBadge key={label} label={label} />
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">
                    No labels
                  </span>
                )}
              </div>
            </div>
            <DetailRow
              icon={CalendarDays}
              value={formatDate(deal.expectedCloseAt)}
            />
          </DealSection>

          <DealSection title="Details">
            <KeyValue label="Stage" value={currentStage?.label || deal.stage} />
            <KeyValue label="Owner" value={ownerName} />
            <KeyValue label="Created" value={formatDate(deal.createdAt)} />
          </DealSection>

          <DealSection title="Source">
            <KeyValue
              label="Source origin"
              value={deal.sourceOrigin || "Manually created"}
            />
            <KeyValue
              label="Source channel"
              value={deal.sourceChannel || "Not set"}
            />
            <KeyValue
              label="Source channel ID"
              value={deal.sourceChannelId || "Not set"}
            />
          </DealSection>

          <DealSection title="Person">
            <DetailRow
              icon={UserRound}
              value={deal.contact?.name || "Not linked"}
            />
            <KeyValue
              label="Phone"
              value={deal.contact?.phone || "Not provided"}
            />
            <KeyValue
              label="Email"
              value={deal.contact?.email || "Not provided"}
            />
          </DealSection>

          <DealSection title="Organization">
            <DetailRow icon={Building2} value={organizationName} />
            <KeyValue
              label="Address"
              value={deal.account?.address || "Not provided"}
            />
            <KeyValue
              label="Website"
              value={deal.account?.website || "Not provided"}
            />
            <KeyValue
              label="Industry"
              value={deal.account?.industry || "Not provided"}
            />
          </DealSection>
        </aside>

        <main className="min-w-0 space-y-6 bg-muted/20 p-4 sm:p-6">
          <ActivityWorkspaceComposer
            tab={tab}
            onTabChange={(nextTab) => {
              setTab(nextTab);
              if (nextTab === "activity") {
                setEditingActivity(null);
                setActivityComposerOpen(true);
              }
            }}
            flushContent
          >
            {tab === "activity" ? (
              activityComposerOpen ? (
                <LeadActivityComposer
                  key={editingActivity?.id || "new-activity"}
                  activity={editingActivity || undefined}
                  activities={deal.activities}
                  contactName={deal.contact?.name}
                  companyName={organizationName}
                  saving={
                    addActivity.isPending ||
                    updateActivity.isPending ||
                    completeActivity.isPending
                  }
                  onCancel={() => {
                    setActivityComposerOpen(false);
                    setEditingActivity(null);
                  }}
                  onSave={saveActivity}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setActivityComposerOpen(true)}
                  className="w-full px-5 py-6 text-left text-sm text-muted-foreground hover:bg-muted/30"
                >
                  Click here to add an activity…
                </button>
              )
            ) : tab === "notes" ? (
              <div className="overflow-hidden bg-amber-50/80 dark:bg-amber-950/20">
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Take a note, @name…"
                  className="min-h-32 resize-y rounded-none border-0 bg-transparent p-5 shadow-none focus-visible:ring-0"
                />
                <div className="flex justify-end gap-2 border-t border-amber-200/70 px-4 py-3 dark:border-amber-900/50">
                  {(note || editingNoteId) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setNote("");
                        setEditingNoteId(null);
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    onClick={() => void saveNote()}
                    disabled={
                      !note.trim() ||
                      addActivity.isPending ||
                      updateNote.isPending
                    }
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : tab === "email" && linkedContact ? (
              <div className="p-5">
                <EmailComposer contact={linkedContact} />
              </div>
            ) : tab === "files" ? (
              <div className="p-5">
                <DealFileWorkspace deal={deal} />
              </div>
            ) : tab === "documents" ? (
              <div className="p-5">
                <DealFileWorkspace deal={deal} documentMode />
              </div>
            ) : tab === "call" ? (
              <ChannelAction
                icon={Phone}
                title={deal.contact?.phone || "No phone number"}
                description="Start a call with the person linked to this deal."
                href={
                  deal.contact?.phone ? `tel:${deal.contact.phone}` : undefined
                }
                action="Call"
              />
            ) : tab === "whatsapp" ? (
              <ChannelAction
                icon={WhatsAppIcon}
                title={deal.contact?.phone || "No phone number"}
                description="Open the linked person in WhatsApp."
                href={
                  deal.contact?.phone
                    ? `https://wa.me/${deal.contact.phone.replace(/\D/g, "")}`
                    : undefined
                }
                action="Open WhatsApp"
              />
            ) : (
              <ActivityWorkspaceEmpty
                title="Nothing to show yet"
                description="Link a person or add content to use this workspace."
              />
            )}
          </ActivityWorkspaceComposer>

          <section>
            <ActivityWorkspaceSectionHeader
              title="Focus"
              expanded={expanded}
              onExpandedChange={setExpanded}
            />
            {focusItems.length ? (
              <div className="mt-4 space-y-3">
                {(expanded ? focusItems : focusItems.slice(0, 3)).map(
                  (activity) => {
                    const Icon = activityIcon(activity);
                    const isPinnedNote = activity.type === "note";
                    const overdue = Boolean(
                      activity.dueAt &&
                      new Date(activity.dueAt).getTime() < currentTime,
                    );
                    return (
                      <div key={activity.id} className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </span>
                        <div className="min-w-0 flex-1 rounded-lg border bg-background p-3 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold">
                                {activity.content}
                              </p>
                              <p
                                className={`mt-1 text-xs ${overdue ? "text-red-600" : "text-emerald-600"}`}
                              >
                                {activity.dueAt
                                  ? new Date(activity.dueAt).toLocaleString()
                                  : "No due date"}
                                {deal.contact?.name
                                  ? ` · ${deal.contact.name}`
                                  : ""}
                                {organizationName !== "Not linked"
                                  ? ` · ${organizationName}`
                                  : ""}
                              </p>
                            </div>
                            <div className="relative shrink-0">
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() =>
                                  setOpenFocusMenuId((current) =>
                                    current === activity.id
                                      ? null
                                      : activity.id,
                                  )
                                }
                                aria-label={`More actions for ${activity.content}`}
                                aria-haspopup="menu"
                                aria-expanded={openFocusMenuId === activity.id}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                              {openFocusMenuId === activity.id && (
                                <div
                                  role="menu"
                                  className="absolute right-0 top-9 z-50 w-44 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenFocusMenuId(null);
                                      if (isPinnedNote) {
                                        setEditingNoteId(activity.id);
                                        setNote(activity.content);
                                        setTab("notes");
                                      } else {
                                        setEditingActivity(activity);
                                        setTab("activity");
                                        setActivityComposerOpen(true);
                                      }
                                    }}
                                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                                  >
                                    <Pencil className="h-4 w-4" /> Edit
                                  </button>
                                  <button
                                    type="button"
                                    disabled={
                                      isPinnedNote
                                        ? updateActivity.isPending
                                        : completeActivity.isPending
                                    }
                                    onClick={() => {
                                      setOpenFocusMenuId(null);
                                      if (isPinnedNote) {
                                        void toggleNotePin(activity);
                                      } else {
                                        void completeActivity
                                          .mutateAsync({
                                            id: deal.id,
                                            activityId: activity.id,
                                          })
                                          .then(() =>
                                            toast.success(
                                              "Activity marked as done",
                                            ),
                                          )
                                          .catch((error: unknown) =>
                                            toast.error(
                                              error instanceof Error
                                                ? error.message
                                                : "Failed to complete activity",
                                            ),
                                          );
                                      }
                                    }}
                                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                                  >
                                    {isPinnedNote ? (
                                      <Pin className="h-4 w-4" />
                                    ) : (
                                      <Check className="h-4 w-4" />
                                    )}
                                    {isPinnedNote ? "Unpin" : "Mark as done"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenFocusMenuId(null);
                                      setDeleteActivityTarget(activity);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" /> Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
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

          <section>
            <ActivityWorkspaceSectionHeader title="History" />
            <div className="mt-4">
              <ActivityWorkspaceHistoryFilters
                filters={[
                  { id: "all", label: "All" },
                  {
                    id: "activities",
                    label: "Activities",
                    count: deal.activities.filter(
                      (item) => item.type !== "note",
                    ).length,
                  },
                  {
                    id: "notes",
                    label: "Notes",
                    count: deal.activities.filter(
                      (item) => item.type === "note" && !attachmentKind(item),
                    ).length,
                  },
                  {
                    id: "files",
                    label: "Files",
                    count: deal.activities.filter(
                      (item) => attachmentKind(item) === "file",
                    ).length,
                  },
                  {
                    id: "documents",
                    label: "Documents",
                    count: deal.activities.filter(
                      (item) => attachmentKind(item) === "document",
                    ).length,
                  },
                ]}
                active={historyFilter}
                onChange={setHistoryFilter}
              />
              {history.length ? (
                <div className="relative space-y-0">
                  {history.map((activity) => {
                    const Icon = activityIcon(activity);
                    const fileKind = attachmentKind(activity);
                    const fileKey = attachmentValue(activity, "fileKey");
                    const fileName =
                      attachmentValue(activity, "fileName") || activity.content;
                    const fileDescription = attachmentValue(
                      activity,
                      "description",
                    );
                    return (
                      <div
                        key={activity.id}
                        className="group relative flex gap-3 pb-4 before:absolute before:left-5 before:top-10 before:h-[calc(100%-16px)] before:border-l before:border-dashed before:border-border last:before:hidden"
                      >
                        <span className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </span>
                        <div
                          className={`min-w-0 flex-1 rounded-lg border px-4 py-3 shadow-sm ${activity.type === "note" && !fileKind ? "border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/20" : "bg-background"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              {fileKind && fileKey ? (
                                <a
                                  href={storageApi.getProxyFileUrl(fileKey)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block truncate text-sm font-semibold text-primary hover:underline"
                                >
                                  {fileName}
                                </a>
                              ) : (
                                <p className="whitespace-pre-wrap text-sm font-medium">
                                  {activity.content}
                                </p>
                              )}
                              <p className="mt-1 text-xs text-muted-foreground">
                                {new Date(activity.createdAt).toLocaleString()}{" "}
                                · {ownerName}
                              </p>
                              {fileDescription && (
                                <p className="mt-2 text-sm text-foreground">
                                  {fileDescription}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                              {fileKind && fileKey ? (
                                <>
                                  <Button
                                    size="icon-xs"
                                    variant="ghost"
                                    onClick={() => {
                                      setFileDescriptionTarget(activity);
                                      setFileDescription(fileDescription);
                                    }}
                                    aria-label="Edit file description"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    asChild
                                    size="icon-xs"
                                    variant="ghost"
                                  >
                                    <a
                                      href={storageApi.getProxyFileUrl(fileKey)}
                                      download={fileName}
                                      aria-label={`Download ${fileName}`}
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                    </a>
                                  </Button>
                                </>
                              ) : activity.type === "note" ? (
                                <>
                                  <Button
                                    size="icon-xs"
                                    variant="ghost"
                                    onClick={() => void toggleNotePin(activity)}
                                    aria-label={
                                      activity.customFields?.pinned === true
                                        ? "Unpin note"
                                        : "Pin note to focus"
                                    }
                                  >
                                    <Pin className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon-xs"
                                    variant="ghost"
                                    onClick={() => {
                                      setEditingNoteId(activity.id);
                                      setNote(activity.content);
                                      setTab("notes");
                                    }}
                                    aria-label="Edit note"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingActivity(activity);
                                    setTab("activity");
                                    setActivityComposerOpen(true);
                                  }}
                                  aria-label="Edit activity"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() =>
                                  setDeleteActivityTarget(activity)
                                }
                                aria-label="Delete activity"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <ActivityWorkspaceEmpty
                  title="No history yet"
                  description="Deal notes and activities will appear here."
                />
              )}
            </div>
          </section>
        </main>
      </div>

      <DealDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        stages={stages}
        owners={owners}
        deal={deal}
      />
      <DeleteConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          void deleteDeal
            .mutateAsync(deal.id)
            .then(() => {
              toast.success("Deal deleted");
              navigate("/dashboard/crm/pipeline");
            })
            .catch((error: unknown) => {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Failed to delete deal",
              );
            });
        }}
        title="Delete deal"
        itemName={deal.title}
        isDeleting={deleteDeal.isPending}
      />
      <DeleteConfirmDialog
        isOpen={Boolean(deleteActivityTarget)}
        onClose={() => setDeleteActivityTarget(null)}
        onConfirm={() => {
          if (!deleteActivityTarget) return;
          const fileKey = attachmentValue(deleteActivityTarget, "fileKey");
          void deleteActivity
            .mutateAsync({ id: deal.id, activityId: deleteActivityTarget.id })
            .then(async () => {
              if (fileKey) {
                try {
                  await storageApi.deleteStorageFile(fileKey);
                } catch {
                  // The deal no longer references the file; storage cleanup can
                  // be retried independently without restoring stale metadata.
                }
              }
              setDeleteActivityTarget(null);
              toast.success(
                attachmentKind(deleteActivityTarget)
                  ? "File deleted"
                  : "Activity deleted",
              );
            })
            .catch((error: unknown) => {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Failed to delete activity",
              );
            });
        }}
        title={
          deleteActivityTarget && attachmentKind(deleteActivityTarget)
            ? "Delete file"
            : "Delete activity"
        }
        description="This item will be permanently removed."
        isDeleting={deleteActivity.isPending}
      />
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
              {fileDescriptionTarget
                ? attachmentValue(fileDescriptionTarget, "fileName") ||
                  fileDescriptionTarget.content
                : ""}
            </p>
            <Textarea
              autoFocus
              value={fileDescription}
              onChange={(event) => setFileDescription(event.target.value)}
              rows={5}
              maxLength={20000}
              placeholder="Add a description…"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFileDescriptionTarget(null)}
                disabled={updateActivity.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void saveFileDescription()}
                disabled={updateActivity.isPending}
              >
                {updateActivity.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DealSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b px-4 py-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function DetailRow({
  icon: Icon,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 py-1.5 text-sm">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate" title={value}>
        {value}
      </span>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 py-1.5 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate" title={value}>
        {value}
      </span>
    </div>
  );
}

function ChannelAction({
  icon: Icon,
  title,
  description,
  href,
  action,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href?: string;
  action: string;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center p-6 text-center">
      <Icon className="h-6 w-6 text-muted-foreground" />
      <p className="mt-2 text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {href && (
        <Button asChild size="sm" className="mt-3">
          <a
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
          >
            {action}
          </a>
        </Button>
      )}
    </div>
  );
}
