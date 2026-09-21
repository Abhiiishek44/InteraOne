import {
  ArrowLeft,
  Building2,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  ContactRound,
  Mail,
  MessageSquare,
  Phone,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  SquareCheckBig,
  Video,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Textarea } from "@/shared/ui/textarea";
import { Input } from "@/shared/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  useContactOwners,
  useContacts,
} from "@/domains/contacts/hooks/use-contacts";
import { DeleteConfirmDialog } from "@/shared/components/delete-confirm-dialog";
import { OpportunityDialog } from "../components/opportunity-dialog";
import {
  useAddOpportunityActivity,
  useCompleteOpportunityActivity,
  useDeleteOpportunity,
  useDeleteOpportunityNote,
  useOpportunities,
  useSalesPipeline,
  useUpdateOpportunityNextAction,
  useUpdateOpportunityNote,
  useUpdateOpportunityStage,
} from "../hooks/use-opportunities";
import type { Opportunity } from "../types/types";

const formatMoney = (value: number, currency: Opportunity["currency"]) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);

const ACTIVITY_CATEGORY_META = {
  todo: {
    label: "To-Do",
    icon: SquareCheckBig,
    iconColor: "text-cyan-500",
    chip: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/60 dark:text-cyan-200",
  },
  email: {
    label: "Email",
    icon: Mail,
    iconColor: "text-violet-500",
    chip: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/60 dark:text-violet-200",
  },
  call: {
    label: "Call",
    icon: Phone,
    iconColor: "text-emerald-500",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
  },
  meeting: {
    label: "Meeting",
    icon: ContactRound,
    iconColor: "text-blue-500",
    chip: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-200",
  },
  document: {
    label: "Document",
    icon: FileText,
    iconColor: "text-orange-500",
    chip: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/60 dark:text-orange-200",
  },
} as const;

export function OpportunityDetailsPage() {
  const navigate = useNavigate();
  const { opportunityId } = useParams<{ opportunityId: string }>();
  const { data: opportunities = [], isLoading } = useOpportunities();
  const { data: contacts = [] } = useContacts();
  const { data: owners = [] } = useContactOwners();
  const { data: pipeline, isLoading: pipelineLoading } = useSalesPipeline();
  const updateStage = useUpdateOpportunityStage();
  const updateNextAction = useUpdateOpportunityNextAction();
  const addActivity = useAddOpportunityActivity();
  const completeActivity = useCompleteOpportunityActivity();
  const deleteOpportunity = useDeleteOpportunity();
  const updateOpportunityNote = useUpdateOpportunityNote();
  const deleteOpportunityNote = useDeleteOpportunityNote();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nextActionEdit, setNextActionEdit] = useState<{
    opportunityId: string;
    value: string;
  }>();
  const [activityDraft, setActivityDraft] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string>();
  const [noteToDelete, setNoteToDelete] =
    useState<Opportunity["activities"][number]>();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(
    () => new Date(),
  );
  const [calendarCategory, setCalendarCategory] = useState<
    "all" | "todo" | "email" | "call" | "meeting" | "document"
  >("all");
  const [scheduleCategory, setScheduleCategory] = useState<
    "todo" | "email" | "call" | "meeting" | "document"
  >("todo");
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleNote, setScheduleNote] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [currentTime] = useState(() => Date.now());
  const opportunity = opportunities.find((item) => item.id === opportunityId);
  const contact = contacts.find((item) => item.id === opportunity?.contact?.id);
  const conversation = contact?.conversations.find(
    (item) => !item.id.startsWith("conv-"),
  );
  const nextActionDraft =
    nextActionEdit && nextActionEdit.opportunityId === opportunity?.id
      ? nextActionEdit.value
      : opportunity?.nextAction || "";
  const stages = pipeline?.stages || [];
  const currentStageIndex = stages.findIndex(
    (stage) => stage.id === opportunity?.stage,
  );
  const currentStage = stages[currentStageIndex];
  const plannedActivities = (opportunity?.activities || []).filter(
    (activity) => activity.type === "planned" && !activity.completedAt,
  );
  const activityTimeline = opportunity?.activities || [];

  const scheduleActivity = async () => {
    if (!opportunity || !scheduleTitle.trim() || !scheduleAt) return;
    const content = scheduleNote.trim()
      ? `${scheduleTitle.trim()}\n${scheduleNote.trim()}`
      : scheduleTitle.trim();
    try {
      await addActivity.mutateAsync({
        id: opportunity.id,
        content,
        dueAt: new Date(scheduleAt).toISOString(),
        category: scheduleCategory,
      });
      setScheduleOpen(false);
      setScheduleTitle("");
      setScheduleNote("");
      setScheduleAt("");
      toast.success("Activity scheduled");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to schedule activity",
      );
    }
  };

  const openMeetingScheduler = (date?: Date) => {
    const selected = date || new Date();
    selected.setHours(9, 0, 0, 0);
    const localValue = new Date(
      selected.getTime() - selected.getTimezoneOffset() * 60_000,
    )
      .toISOString()
      .slice(0, 16);
    setScheduleCategory("meeting");
    setScheduleAt(localValue);
    setCalendarOpen(false);
    setScheduleOpen(true);
  };

  const calendarStart = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth(),
    1 - calendarMonth.getDay(),
  );
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    return date;
  });
  const scheduledActivities = (opportunity?.activities || []).filter(
    (activity) => activity.dueAt,
  );
  const visibleCalendarActivities = scheduledActivities.filter(
    (activity) =>
      calendarCategory === "all" || activity.category === calendarCategory,
  );
  const scheduledByDate = visibleCalendarActivities.reduce(
    (groups, activity) => {
      if (!activity.dueAt) return groups;
      const key = new Date(activity.dueAt).toLocaleDateString("en-CA");
      const current = groups.get(key) || [];
      current.push(activity);
      groups.set(key, current);
      return groups;
    },
    new Map<string, Opportunity["activities"]>(),
  );
  const monthActivities = scheduledActivities.filter((activity) => {
    const due = new Date(activity.dueAt!);
    return (
      due.getFullYear() === calendarMonth.getFullYear() &&
      due.getMonth() === calendarMonth.getMonth()
    );
  });
  const pendingMonthActivities = monthActivities.filter(
    (activity) => !activity.completedAt,
  ).length;
  const selectedDateKey = selectedCalendarDate.toLocaleDateString("en-CA");
  const selectedDateActivities = (scheduledByDate.get(selectedDateKey) || [])
    .slice()
    .sort(
      (left, right) =>
        new Date(left.dueAt!).getTime() - new Date(right.dueAt!).getTime(),
    );
  const nextMeeting = scheduledActivities
    .filter(
      (activity) =>
        activity.category === "meeting" &&
        !activity.completedAt &&
        new Date(activity.dueAt!).getTime() >= currentTime,
    )
    .sort(
      (left, right) =>
        new Date(left.dueAt!).getTime() - new Date(right.dueAt!).getTime(),
    )[0];

  const saveNextAction = async () => {
    if (!opportunity) return;
    try {
      await updateNextAction.mutateAsync({
        id: opportunity.id,
        nextAction: nextActionDraft,
      });
      setNextActionEdit(undefined);
      toast.success("Next action saved");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save next action",
      );
    }
  };

  const recordActivity = async () => {
    const content = activityDraft.trim();
    if (!opportunity || !content) return;
    try {
      if (editingNoteId) {
        await updateOpportunityNote.mutateAsync({
          id: opportunity.id,
          activityId: editingNoteId,
          content,
        });
      } else {
        await addActivity.mutateAsync({ id: opportunity.id, content });
      }
      setActivityDraft("");
      setEditingNoteId(undefined);
      toast.success(editingNoteId ? "Note updated" : "Note added");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save note",
      );
    }
  };

  const startEditingNote = (activity: Opportunity["activities"][number]) => {
    setEditingNoteId(activity.id);
    setActivityDraft(activity.content);
    requestAnimationFrame(() =>
      document.getElementById("opportunity-activity-composer")?.focus(),
    );
  };

  const cancelEditingNote = () => {
    setEditingNoteId(undefined);
    setActivityDraft("");
  };

  const changeStage = async (stage: string) => {
    if (!opportunity || stage === opportunity.stage) return;
    try {
      await updateStage.mutateAsync({ id: opportunity.id, stage });
      toast.success(
        `Opportunity moved to ${stages.find((item) => item.id === stage)?.label || "stage"}`,
      );
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to change stage",
      );
    }
  };

  if (isLoading || pipelineLoading) {
    return (
      <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground">
        Loading opportunity…
      </div>
    );
  }

  if (!opportunity) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <h1 className="text-lg font-semibold">Opportunity not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            It may have been removed or is not available in this organization.
          </p>
          <Button
            className="mt-5"
            onClick={() => navigate("/dashboard/crm/pipeline")}
          >
            Back to pipeline
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => navigate("/dashboard/crm/pipeline")}
            title="Back to pipeline"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{opportunity.title}</h1>
              <Badge variant="outline">
                {currentStage?.label || opportunity.stage}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {opportunity.contact?.name || "Unknown contact"}
              {opportunity.company ? ` · ${opportunity.company}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCalendarOpen(true)}
          >
            <Video className="mr-2 h-4 w-4" />
            <span>Meetings calendar</span>
            {nextMeeting?.dueAt && (
              <Badge variant="secondary" className="ml-2 text-[10px]">
                Next ·{" "}
                {new Date(nextMeeting.dueAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                })}
              </Badge>
            )}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (conversation) {
                navigate(
                  `/dashboard/conversations/inbox/chat/${conversation.id}`,
                );
                return;
              }
              if (!opportunity.contact?.email) {
                toast.error("No existing conversation or email is available");
                return;
              }
              window.location.href = `mailto:${encodeURIComponent(opportunity.contact.email)}?subject=${encodeURIComponent(opportunity.title)}`;
            }}
          >
            <MessageSquare className="mr-2 h-4 w-4" /> Send message
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setScheduleOpen(true)}
          >
            <CalendarPlus className="mr-2 h-4 w-4" /> Schedule activity
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              document.getElementById("opportunity-activity-composer")?.focus()
            }
          >
            Log note
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDeleteOpen(true)}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </header>

      <section>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Pipeline progress — select a stage to move this opportunity
        </p>
        <div className="overflow-x-auto rounded-lg border bg-muted/15 p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max items-center px-1">
            {stages.map((stage, index) => (
              <button
                key={stage.id}
                type="button"
                onClick={() => void changeStage(stage.id)}
                disabled={updateStage.isPending}
                style={{
                  clipPath:
                    index === 0
                      ? "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)"
                      : "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)",
                }}
                className={`relative min-w-40 py-3 pl-6 pr-7 text-center text-xs font-semibold transition-colors first:pl-4 ${index > 0 ? "-ml-3" : ""} ${
                  index === currentStageIndex
                    ? "z-20 bg-primary text-primary-foreground shadow-sm"
                    : index < currentStageIndex
                      ? "z-10 bg-primary/15 text-primary hover:bg-primary/25"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                {stage.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          icon={CircleDollarSign}
          label="Opportunity value"
          value={formatMoney(opportunity.value, opportunity.currency)}
        />
        <MetricCard
          icon={CalendarDays}
          label="Expected close"
          value={
            opportunity.expectedCloseAt
              ? new Date(opportunity.expectedCloseAt).toLocaleDateString()
              : "No close date"
          }
        />
        <MetricCard
          icon={UserRound}
          label="Opportunity owner"
          value={opportunity.owner?.name || "Unassigned"}
          supporting={opportunity.owner?.email}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Contact and organization</h2>
          </div>
          <CardContent className="grid gap-5 p-5 sm:grid-cols-2">
            <InfoRow
              icon={UserRound}
              label="Contact"
              value={opportunity.contact?.name || "Unknown contact"}
            />
            <InfoRow
              icon={Building2}
              label="Organization"
              value={
                opportunity.company ||
                opportunity.contact?.company ||
                "Not provided"
              }
            />
            <InfoRow
              icon={Mail}
              label="Email"
              value={opportunity.contact?.email || "Not provided"}
            />
            <InfoRow
              icon={Phone}
              label="Phone"
              value={opportunity.contact?.phone || "Not provided"}
            />
          </CardContent>
        </Card>

        <Card>
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Next action</h2>
          </div>
          <CardContent className="p-5">
            <Textarea
              value={nextActionDraft}
              onChange={(event) =>
                setNextActionEdit({
                  opportunityId: opportunity.id,
                  value: event.target.value,
                })
              }
              placeholder="Add the next follow-up, task, or commitment…"
              maxLength={500}
              className="min-h-24 resize-none"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {nextActionDraft.length}/500
              </span>
              <Button
                size="sm"
                onClick={() => void saveNextAction()}
                disabled={
                  updateNextAction.isPending ||
                  nextActionDraft === opportunity.nextAction
                }
              >
                {updateNextAction.isPending ? "Saving…" : "Save next action"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Clock3 className="h-4 w-4" /> Opportunity notes
          </h2>
          <div className="flex gap-3">
            <Textarea
              id="opportunity-activity-composer"
              value={activityDraft}
              onChange={(event) => setActivityDraft(event.target.value)}
              placeholder={
                editingNoteId
                  ? "Update this internal note…"
                  : "Add an internal note about this opportunity…"
              }
              maxLength={2000}
              className="min-h-20 resize-none"
            />
            <div className="flex self-end gap-2">
              {editingNoteId && (
                <Button variant="outline" onClick={cancelEditingNote}>
                  Cancel
                </Button>
              )}
              <Button
                onClick={() => void recordActivity()}
                disabled={
                  !activityDraft.trim() ||
                  addActivity.isPending ||
                  updateOpportunityNote.isPending
                }
              >
                {addActivity.isPending || updateOpportunityNote.isPending
                  ? "Saving…"
                  : editingNoteId
                    ? "Save note"
                    : "Add note"}
              </Button>
            </div>
          </div>
          {plannedActivities.length > 0 && (
            <div className="mt-6 border-t pt-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Planned activities
              </h3>
              <div className="space-y-2">
                {plannedActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between gap-3 rounded-md border bg-primary/[0.03] p-3"
                  >
                    <div>
                      <Badge variant="secondary" className="mb-1 capitalize">
                        {(() => {
                          const meta =
                            ACTIVITY_CATEGORY_META[activity.category || "todo"];
                          const ActivityIcon = meta.icon;
                          return (
                            <>
                              <ActivityIcon
                                className={`mr-1 h-3.5 w-3.5 ${meta.iconColor}`}
                              />
                              {meta.label}
                            </>
                          );
                        })()}
                      </Badge>
                      <p className="whitespace-pre-wrap text-sm font-medium">
                        {activity.content}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Due{" "}
                        {activity.dueAt
                          ? new Date(activity.dueAt).toLocaleString()
                          : "without a date"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={completeActivity.isPending}
                      onClick={() =>
                        void completeActivity.mutateAsync({
                          id: opportunity.id,
                          activityId: activity.id,
                        })
                      }
                    >
                      <CheckCircle2 className="mr-1.5 h-4 w-4" /> Done
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-5 border-t pt-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              History
            </h3>
            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-2">
              {activityTimeline.map((activity) => (
                <div
                  key={activity.id}
                  className="group rounded-md bg-muted/35 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {activity.type === "status"
                        ? "Stage change"
                        : activity.completedAt
                          ? "Completed"
                          : activity.type === "planned"
                            ? "Scheduled"
                            : activity.type}
                    </Badge>
                    {activity.type === "note" && (
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-60">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => startEditingNote(activity)}
                          title="Edit note"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setNoteToDelete(activity)}
                          title="Delete note"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm">
                    {activity.content}
                  </p>
                  {activity.type === "planned" && activity.dueAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Due {new Date(activity.dueAt).toLocaleString()}
                    </p>
                  )}
                  <time className="mt-1.5 block text-xs text-muted-foreground">
                    {new Date(activity.createdAt).toLocaleString()}
                  </time>
                </div>
              ))}
              {activityTimeline.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No activity has been recorded yet.
                </p>
              )}
            </div>
            <div className="grid gap-2 pt-2 text-xs text-muted-foreground sm:grid-cols-2">
              <p>Created {new Date(opportunity.createdAt).toLocaleString()}</p>
              <p>
                Last updated {new Date(opportunity.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
        <DialogContent className="max-h-[92vh] max-w-6xl gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b bg-gradient-to-r from-primary/[0.08] via-background to-background px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
              <div>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  Opportunity calendar
                </DialogTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {opportunity.title} · {opportunity.contact?.name || "Contact"}
                </p>
              </div>
              <Button
                className="shadow-sm"
                onClick={() => openMeetingScheduler()}
              >
                <Video className="mr-2 h-4 w-4" /> Add meeting
              </Button>
            </div>
          </DialogHeader>
          <div className="overflow-y-auto p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 rounded-lg border bg-card p-1 shadow-xs">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setCalendarMonth(
                      (month) =>
                        new Date(month.getFullYear(), month.getMonth() - 1, 1),
                    )
                  }
                  title="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setCalendarMonth(
                      (month) =>
                        new Date(month.getFullYear(), month.getMonth() + 1, 1),
                    )
                  }
                  title="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <h3 className="text-lg font-semibold tracking-tight">
                {calendarMonth.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </h3>
              <div className="flex items-center gap-2">
                <span className="rounded-lg border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-xs">
                  <strong className="text-foreground">
                    {monthActivities.length}
                  </strong>{" "}
                  events ·{" "}
                  <strong className="text-foreground">
                    {pendingMonthActivities}
                  </strong>{" "}
                  pending
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    setCalendarMonth(
                      new Date(today.getFullYear(), today.getMonth(), 1),
                    );
                    setSelectedCalendarDate(today);
                  }}
                >
                  Today
                </Button>
              </div>
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-1 rounded-lg border bg-muted/20 p-1.5">
              {(
                ["all", "todo", "email", "call", "meeting", "document"] as const
              ).map((category) => {
                const meta =
                  category === "all" ? null : ACTIVITY_CATEGORY_META[category];
                const FilterIcon = meta?.icon;
                return (
                  <Button
                    key={category}
                    type="button"
                    size="sm"
                    variant={
                      calendarCategory === category ? "secondary" : "ghost"
                    }
                    onClick={() => setCalendarCategory(category)}
                    className="h-7 px-2.5 text-xs"
                  >
                    {FilterIcon && (
                      <FilterIcon
                        className={`mr-1.5 h-3.5 w-3.5 ${meta!.iconColor}`}
                      />
                    )}
                    {category === "all" ? "All activities" : meta!.label}
                  </Button>
                );
              })}
            </div>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="overflow-x-auto">
                <div className="grid min-w-[760px] grid-cols-7 gap-px overflow-hidden rounded-xl border bg-border shadow-sm">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day) => (
                      <div
                        key={day}
                        className="bg-muted/80 px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {day}
                      </div>
                    ),
                  )}
                  {calendarDays.map((date) => {
                    const key = date.toLocaleDateString("en-CA");
                    const activities = scheduledByDate.get(key) || [];
                    const inCurrentMonth =
                      date.getMonth() === calendarMonth.getMonth();
                    const isToday =
                      key === new Date().toLocaleDateString("en-CA");
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedCalendarDate(new Date(date))}
                        className={`group min-h-30 bg-background p-2 text-left transition-colors hover:bg-primary/[0.035] ${
                          date.getDay() === 0 || date.getDay() === 6
                            ? "bg-muted/[0.18]"
                            : ""
                        } ${
                          key === selectedDateKey
                            ? "relative z-10 ring-2 ring-inset ring-primary/45"
                            : ""
                        } ${inCurrentMonth ? "" : "opacity-45"}`}
                        title={`View activities for ${date.toLocaleDateString()}`}
                      >
                        <span
                          className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-xs transition-colors ${
                            isToday
                              ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                              : "font-medium group-hover:bg-muted"
                          }`}
                        >
                          {date.getDate()}
                        </span>
                        <div className="mt-1 space-y-1">
                          {activities.slice(0, 3).map((activity) => {
                            const meta =
                              ACTIVITY_CATEGORY_META[
                                activity.category || "todo"
                              ];
                            const ActivityIcon = meta.icon;
                            return (
                              <span
                                key={activity.id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedCalendarDate(new Date(date));
                                }}
                                className={`flex items-center gap-1 truncate rounded-md border px-1.5 py-1 text-[10px] font-medium shadow-xs ${meta.chip} ${
                                  activity.completedAt
                                    ? "text-muted-foreground line-through opacity-60"
                                    : "text-foreground"
                                }`}
                              >
                                <ActivityIcon
                                  className={`h-3 w-3 shrink-0 ${meta.iconColor}`}
                                />
                                <span className="truncate">
                                  {new Date(activity.dueAt!).toLocaleTimeString(
                                    [],
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )}{" "}
                                  {activity.content.split("\n")[0]}
                                </span>
                              </span>
                            );
                          })}
                          {activities.length > 3 && (
                            <span className="block text-[10px] text-muted-foreground">
                              +{activities.length - 3} more
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <aside className="rounded-xl border bg-card shadow-sm">
                <div className="border-b p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Selected day
                  </p>
                  <h4 className="mt-1 font-semibold">
                    {selectedCalendarDate.toLocaleDateString(undefined, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </h4>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        openMeetingScheduler(new Date(selectedCalendarDate))
                      }
                    >
                      <Video className="mr-1.5 h-3.5 w-3.5" /> Meeting
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const date = new Date(selectedCalendarDate);
                        date.setHours(9, 0, 0, 0);
                        const localValue = new Date(
                          date.getTime() - date.getTimezoneOffset() * 60_000,
                        )
                          .toISOString()
                          .slice(0, 16);
                        setScheduleCategory("todo");
                        setScheduleAt(localValue);
                        setCalendarOpen(false);
                        setScheduleOpen(true);
                      }}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Activity
                    </Button>
                  </div>
                </div>
                <div className="max-h-[470px] space-y-2 overflow-y-auto p-3">
                  {selectedDateActivities.map((activity) => {
                    const meta =
                      ACTIVITY_CATEGORY_META[activity.category || "todo"];
                    const ActivityIcon = meta.icon;
                    return (
                      <div
                        key={activity.id}
                        className={`rounded-lg border p-3 ${meta.chip}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <ActivityIcon
                              className={`h-4 w-4 shrink-0 ${meta.iconColor}`}
                            />
                            <span className="text-xs font-semibold">
                              {new Date(activity.dueAt!).toLocaleTimeString(
                                [],
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </span>
                          </div>
                          {!activity.completedAt && (
                            <button
                              type="button"
                              onClick={() =>
                                void completeActivity.mutateAsync({
                                  id: opportunity.id,
                                  activityId: activity.id,
                                })
                              }
                              className="text-[10px] font-semibold hover:underline"
                            >
                              Mark done
                            </button>
                          )}
                        </div>
                        <p
                          className={`mt-2 whitespace-pre-wrap text-xs leading-5 ${
                            activity.completedAt
                              ? "line-through opacity-60"
                              : ""
                          }`}
                        >
                          {activity.content}
                        </p>
                      </div>
                    );
                  })}
                  {selectedDateActivities.length === 0 && (
                    <div className="px-3 py-10 text-center">
                      <CalendarPlus className="mx-auto h-7 w-7 text-muted-foreground/50" />
                      <p className="mt-2 text-sm font-medium">
                        No activities planned
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Select an action above to schedule one.
                      </p>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Schedule an activity</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {(["todo", "email", "call", "meeting", "document"] as const).map(
              (category) => {
                const meta = ACTIVITY_CATEGORY_META[category];
                const CategoryIcon = meta.icon;
                return (
                  <Button
                    key={category}
                    type="button"
                    size="sm"
                    variant={
                      scheduleCategory === category ? "default" : "outline"
                    }
                    onClick={() => setScheduleCategory(category)}
                  >
                    <CategoryIcon
                      className={`mr-1.5 h-4 w-4 ${meta.iconColor}`}
                    />
                    {meta.label}
                  </Button>
                );
              },
            )}
          </div>
          <Input
            value={scheduleTitle}
            onChange={(event) => setScheduleTitle(event.target.value)}
            placeholder="Activity summary"
            maxLength={200}
          />
          <Input
            type="datetime-local"
            value={scheduleAt}
            onChange={(event) => setScheduleAt(event.target.value)}
          />
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
            Assigned to:{" "}
            <span className="font-medium">
              {opportunity.owner?.name || "Unassigned"}
            </span>
          </div>
          <Textarea
            value={scheduleNote}
            onChange={(event) => setScheduleNote(event.target.value)}
            placeholder="Add a note or instructions…"
            maxLength={1500}
            className="min-h-24 resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>
              Discard
            </Button>
            <Button
              onClick={() => void scheduleActivity()}
              disabled={
                !scheduleTitle.trim() || !scheduleAt || addActivity.isPending
              }
            >
              {addActivity.isPending ? "Scheduling…" : "Schedule activity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <OpportunityDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        stages={stages}
        owners={owners}
        opportunity={opportunity}
      />
      <DeleteConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          void deleteOpportunity
            .mutateAsync(opportunity.id)
            .then(() => {
              toast.success("Opportunity deleted");
              navigate("/dashboard/crm/pipeline");
            })
            .catch((error: unknown) => {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Failed to delete opportunity",
              );
            });
        }}
        title="Delete opportunity"
        itemName={opportunity.title}
        isDeleting={deleteOpportunity.isPending}
      />
      <DeleteConfirmDialog
        isOpen={Boolean(noteToDelete)}
        onClose={() => setNoteToDelete(undefined)}
        onConfirm={() => {
          if (!noteToDelete) return;
          void deleteOpportunityNote
            .mutateAsync({
              id: opportunity.id,
              activityId: noteToDelete.id,
            })
            .then(() => {
              if (editingNoteId === noteToDelete.id) cancelEditingNote();
              setNoteToDelete(undefined);
              toast.success("Note deleted");
            })
            .catch((error: unknown) => {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Failed to delete note",
              );
            });
        }}
        title="Delete opportunity note"
        description="Are you sure you want to delete this note? This action cannot be undone."
        isDeleting={deleteOpportunityNote.isPending}
      />
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  supporting,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  supporting?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Icon className="h-4 w-4" /> {label}
        </p>
        <p className="mt-2 text-xl font-semibold">{value}</p>
        {supporting && (
          <p className="mt-1 text-xs text-muted-foreground">{supporting}</p>
        )}
      </CardContent>
    </Card>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium" title={value}>
          {value}
        </p>
      </div>
    </div>
  );
}
