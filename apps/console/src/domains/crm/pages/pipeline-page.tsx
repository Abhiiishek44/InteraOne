import { useMemo, useRef, useState, type DragEvent } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import {
  CalendarDays,
  CalendarPlus,
  CircleDollarSign,
  FileText,
  ContactRound,
  GripVertical,
  LayoutGrid,
  List,
  Mail,
  MoreVertical,
  Plus,
  Phone,
  Search,
  Star,
  SquareCheckBig,
  Settings2,
  Target,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { useContactOwners } from "@/domains/contacts/hooks/use-contacts";
import { authApi } from "@/domains/auth/api/auth.api";
import { OpportunityDialog } from "../components/opportunity-dialog";
import { PipelineSettingsDialog } from "../components/pipeline-settings-dialog";
import {
  useOpportunities,
  useMoveOpportunity,
  useAddOpportunityActivity,
  useSalesPipeline,
  useUpdateOpportunityColor,
  useUpdateOpportunityPriority,
  useUpdateSalesPipeline,
} from "../hooks/use-opportunities";
import type {
  Opportunity,
  OpportunityColor,
  PipelineStageType,
} from "../types/types";

const OPPORTUNITY_COLORS: Record<
  OpportunityColor,
  { swatch: string; border: string }
> = {
  slate: { swatch: "bg-slate-500", border: "border-l-slate-500" },
  red: { swatch: "bg-red-400", border: "border-l-red-400" },
  orange: { swatch: "bg-orange-300", border: "border-l-orange-300" },
  amber: { swatch: "bg-amber-300", border: "border-l-amber-300" },
  yellow: { swatch: "bg-yellow-300", border: "border-l-yellow-300" },
  cyan: { swatch: "bg-cyan-300", border: "border-l-cyan-300" },
  blue: { swatch: "bg-blue-400", border: "border-l-blue-400" },
  violet: { swatch: "bg-violet-400", border: "border-l-violet-400" },
  pink: { swatch: "bg-pink-400", border: "border-l-pink-400" },
  emerald: { swatch: "bg-emerald-300", border: "border-l-emerald-300" },
};

const ACTIVITY_CATEGORY_META = {
  todo: {
    label: "To-Do",
    icon: SquareCheckBig,
    iconColor: "text-cyan-500",
  },
  email: {
    label: "Email",
    icon: Mail,
    iconColor: "text-violet-500",
  },
  call: {
    label: "Call",
    icon: Phone,
    iconColor: "text-emerald-500",
  },
  meeting: {
    label: "Meeting",
    icon: ContactRound,
    iconColor: "text-blue-500",
  },
  document: {
    label: "Document",
    icon: FileText,
    iconColor: "text-orange-500",
  },
} as const;

const formatMoney = (value: number, currency: Opportunity["currency"]) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);

export function PipelinePage() {
  const navigate = useNavigate();
  const orgRole = authApi.getOrgRole();
  const canCustomizePipeline = orgRole === "owner" || orgRole === "admin";
  const { data: opportunities = [], isLoading } = useOpportunities();
  const { data: pipeline, isLoading: pipelineLoading } = useSalesPipeline();
  const { data: owners = [] } = useContactOwners();
  const moveOpportunityMutation = useMoveOpportunity();
  const addActivity = useAddOpportunityActivity();
  const updatePriority = useUpdateOpportunityPriority();
  const updateColor = useUpdateOpportunityColor();
  const updatePipeline = useUpdateSalesPipeline();
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsStageId, setSettingsStageId] = useState<string>();
  const [colorMenuId, setColorMenuId] = useState<string>();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [draggedStageId, setDraggedStageId] = useState<string>();
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string>();
  const [scheduleForId, setScheduleForId] = useState<string>();
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleCategory, setScheduleCategory] = useState<
    "todo" | "email" | "call" | "meeting" | "document"
  >("todo");
  const [view, setView] = useState<"board" | "list">("board");
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | PipelineStageType>(
    "all",
  );
  const [currentTime] = useState(() => Date.now());
  const wasDragging = useRef(false);

  const stages = useMemo(() => pipeline?.stages || [], [pipeline?.stages]);
  const stageMap = useMemo(
    () => new Map(stages.map((stage) => [stage.id, stage])),
    [stages],
  );
  const countsByStage = useMemo(() => {
    const counts = new Map<string, number>();
    opportunities.forEach((item) =>
      counts.set(item.stage, (counts.get(item.stage) || 0) + 1),
    );
    return counts;
  }, [opportunities]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return opportunities.filter((item) => {
      const stage = stageMap.get(item.stage);
      const searchMatch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.contact?.name.toLowerCase().includes(query) ||
        item.company?.toLowerCase().includes(query);
      const ownerMatch =
        ownerFilter === "all" ||
        (ownerFilter === "unassigned"
          ? !item.owner
          : item.owner?.id === ownerFilter);
      const typeMatch = typeFilter === "all" || stage?.type === typeFilter;
      return searchMatch && ownerMatch && typeMatch;
    });
  }, [opportunities, ownerFilter, search, stageMap, typeFilter]);

  const metrics = useMemo(() => {
    const open = opportunities.filter(
      (item) => stageMap.get(item.stage)?.type === "open",
    );
    const won = opportunities.filter(
      (item) => stageMap.get(item.stage)?.type === "won",
    ).length;
    const lost = opportunities.filter(
      (item) => stageMap.get(item.stage)?.type === "lost",
    ).length;
    const totals = new Map<Opportunity["currency"], number>();
    open.forEach((item) =>
      totals.set(item.currency, (totals.get(item.currency) || 0) + item.value),
    );
    const closed = won + lost;
    return {
      open: open.length,
      value:
        Array.from(totals.entries())
          .map(([currency, value]) => formatMoney(value, currency))
          .join(" · ") || formatMoney(0, "USD"),
      winRate: closed ? Math.round((won / closed) * 100) : 0,
      overdue: open.filter(
        (item) =>
          item.expectedCloseAt &&
          new Date(item.expectedCloseAt).getTime() < currentTime,
      ).length,
    };
  }, [currentTime, opportunities, stageMap]);

  const openCreate = () => {
    setCreateOpen(true);
  };

  const openStageSettings = (stageId?: string) => {
    setSettingsStageId(stageId);
    setSettingsOpen(true);
  };

  const openNewStage = () => {
    setSettingsOpen(false);
    setSettingsStageId(undefined);
    requestAnimationFrame(() => setSettingsOpen(true));
  };

  const moveOpportunity = async (
    id: string,
    stage: string,
    position: number,
  ) => {
    const item = opportunities.find((opportunity) => opportunity.id === id);
    if (!item) return;
    try {
      await moveOpportunityMutation.mutateAsync({ id, stage, position });
      toast.success(`Moved to ${stageMap.get(stage)?.label || "stage"}`);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to move opportunity",
      );
    }
  };

  const setOpportunityColor = async (
    opportunityId: string,
    color: OpportunityColor,
  ) => {
    setColorMenuId(undefined);
    try {
      await updateColor.mutateAsync({ id: opportunityId, color });
      toast.success("Opportunity color updated");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update color",
      );
    }
  };

  const reorderStage = async (targetStageId: string) => {
    if (!pipeline || !draggedStageId || draggedStageId === targetStageId) {
      return;
    }
    const sourceIndex = stages.findIndex(
      (stage) => stage.id === draggedStageId,
    );
    const targetIndex = stages.findIndex((stage) => stage.id === targetStageId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const reordered = [...stages];
    const [movedStage] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, movedStage);
    try {
      await updatePipeline.mutateAsync({
        name: pipeline.name,
        stages: reordered.map((stage, order) => ({ ...stage, order })),
      });
      toast.success("Pipeline stages reordered");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reorder stages",
      );
    }
  };

  const drop = (event: DragEvent, stage: string, position?: number) => {
    event.preventDefault();
    if (draggedStageId) {
      void reorderStage(stage);
      setDraggedStageId(undefined);
      setDragOverStage(null);
      return;
    }
    const id = draggedId;
    setDraggedId(null);
    setDragOverStage(null);
    setDropTargetId(undefined);
    if (id) {
      const bottomPosition = opportunities.filter(
        (item) => item.stage === stage && item.id !== id,
      ).length;
      void moveOpportunity(id, stage, position ?? bottomPosition);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">
              {pipeline?.name || "Sales pipeline"}
            </h1>
            {pipeline?.isDefault && <Badge variant="outline">Default</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize deals, monitor progress, and keep every next action
            visible.
          </p>
        </div>
        <Button onClick={openCreate} disabled={pipelineLoading}>
          <Plus className="mr-2 h-4 w-4" /> New opportunity
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Open opportunities", value: metrics.open, icon: Target },
          {
            label: "Open pipeline value",
            value: metrics.value,
            icon: CircleDollarSign,
          },
          { label: "Win rate", value: `${metrics.winRate}%`, icon: TrendingUp },
          {
            label: "Overdue close dates",
            value: metrics.overdue,
            icon: CalendarDays,
          },
        ].map((metric) => (
          <Card key={metric.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {metric.label}
                </p>
                <p className="mt-1 text-xl font-semibold tracking-tight">
                  {metric.value}
                </p>
              </div>
              <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                <metric.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-3">
          <div className="relative min-w-60 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search opportunities, contacts, or companies"
              className="pl-9"
            />
          </div>
          <select
            value={ownerFilter}
            onChange={(event) => setOwnerFilter(event.target.value)}
            className="h-9 min-w-40 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Filter by owner"
          >
            <option value="all">All owners</option>
            <option value="unassigned">Unassigned</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value as "all" | PipelineStageType)
            }
            className="h-9 min-w-36 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Filter by outcome"
          >
            <option value="all">All outcomes</option>
            <option value="open">Open</option>
            <option value="won">Closed won</option>
            <option value="lost">Closed lost</option>
          </select>
          <div className="flex rounded-md border border-input p-0.5">
            <Button
              variant={view === "board" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("board")}
              className="h-7"
            >
              <LayoutGrid className="mr-1.5 h-3.5 w-3.5" /> Board
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("list")}
              className="h-7"
            >
              <List className="mr-1.5 h-3.5 w-3.5" /> List
            </Button>
          </div>
        </CardContent>
      </Card>

      {view === "board" ? (
        <div className="overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max items-start gap-2">
            {stages.map((stage) => {
              const items = filtered
                .filter((item) => item.stage === stage.id)
                .sort((left, right) => left.position - right.position);
              const currencies = new Set(items.map((item) => item.currency));
              const stageValue = items.reduce(
                (sum, item) => sum + item.value,
                0,
              );
              return (
                <motion.section
                  key={stage.id}
                  layout
                  animate={{
                    scaleX: dragOverStage === stage.id ? 1.018 : 1,
                    scaleY: draggedStageId === stage.id ? 0.975 : 1,
                    opacity: draggedStageId === stage.id ? 0.72 : 1,
                  }}
                  transition={{
                    layout: { type: "spring", stiffness: 420, damping: 34 },
                    scaleX: { type: "spring", stiffness: 500, damping: 30 },
                    scaleY: { type: "spring", stiffness: 500, damping: 30 },
                    opacity: { duration: 0.16 },
                  }}
                  className={`flex min-h-32 w-[300px] min-w-0 max-w-[300px] shrink-0 flex-col self-start overflow-visible border-x bg-muted/10 transition-colors ${
                    dragOverStage === stage.id
                      ? "border-x-primary bg-primary/[0.04]"
                      : "border-x-border"
                  }`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverStage(stage.id);
                  }}
                  onDragLeave={() => setDragOverStage(null)}
                  onDrop={(event) => drop(event, stage.id)}
                >
                  <header
                    draggable={canCustomizePipeline}
                    onDragStart={(event) => {
                      if (!canCustomizePipeline) return;
                      if ((event.target as HTMLElement).closest("button")) {
                        event.preventDefault();
                        return;
                      }
                      event.stopPropagation();
                      event.dataTransfer.effectAllowed = "move";
                      setDraggedId(null);
                      setDraggedStageId(stage.id);
                    }}
                    onDragEnd={() => {
                      setDraggedStageId(undefined);
                      setDragOverStage(null);
                    }}
                    className={`bg-card/70 px-3 py-3 ${
                      canCustomizePipeline
                        ? "cursor-grab active:cursor-grabbing"
                        : ""
                    }`}
                    title={
                      canCustomizePipeline
                        ? "Drag to reorder this stage"
                        : undefined
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-semibold">
                            {stage.label}
                          </h2>
                          <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground shadow-xs">
                            {items.length}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {currencies.size > 1
                            ? "Multiple currencies"
                            : formatMoney(
                                stageValue,
                                items[0]?.currency || "USD",
                              )}
                        </p>
                      </div>
                      {canCustomizePipeline && (
                        <div className="flex items-center">
                          <GripVertical className="h-4 w-4 text-muted-foreground/60" />
                          <Button
                            draggable={false}
                            variant="ghost"
                            size="icon"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={() => openStageSettings(stage.id)}
                            className="h-7 w-7"
                            title={`Customize ${stage.label}`}
                          >
                            <Settings2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </header>
                  <div className="space-y-2 p-2.5">
                    {items.map((item) => (
                      <motion.article
                        key={item.id}
                        layout
                        animate={{
                          scaleX: draggedId === item.id ? 1.025 : 1,
                          scaleY: draggedId === item.id ? 1.04 : 1,
                          opacity: draggedId === item.id ? 0.68 : 1,
                        }}
                        transition={{
                          layout: {
                            type: "spring",
                            stiffness: 460,
                            damping: 32,
                          },
                          scaleX: {
                            type: "spring",
                            stiffness: 520,
                            damping: 28,
                          },
                          scaleY: {
                            type: "spring",
                            stiffness: 520,
                            damping: 28,
                          },
                          opacity: { duration: 0.14 },
                        }}
                        draggable
                        onClick={() => {
                          if (wasDragging.current) return;
                          setColorMenuId(undefined);
                          navigate(`/dashboard/crm/pipeline/${item.id}`);
                        }}
                        onDragStart={(event) => {
                          wasDragging.current = true;
                          event.stopPropagation();
                          setDraggedStageId(undefined);
                          setDraggedId(item.id);
                        }}
                        onDragOver={(event) => {
                          if (
                            !draggedId ||
                            draggedStageId ||
                            draggedId === item.id
                          )
                            return;
                          event.preventDefault();
                          event.stopPropagation();
                          event.dataTransfer.dropEffect = "move";
                          setDragOverStage(stage.id);
                          const bounds =
                            event.currentTarget.getBoundingClientRect();
                          const edge =
                            event.clientY > bounds.top + bounds.height / 2
                              ? "after"
                              : "before";
                          setDropTargetId(`${edge}:${item.id}`);
                        }}
                        onDrop={(event) => {
                          if (!draggedId || draggedStageId) return;
                          event.preventDefault();
                          event.stopPropagation();
                          const targetItems = items.filter(
                            (candidate) => candidate.id !== draggedId,
                          );
                          const targetPosition = targetItems.findIndex(
                            (candidate) => candidate.id === item.id,
                          );
                          const insertAfter =
                            dropTargetId === `after:${item.id}` ? 1 : 0;
                          drop(
                            event,
                            stage.id,
                            targetPosition < 0
                              ? targetItems.length
                              : targetPosition + insertAfter,
                          );
                        }}
                        onDragEnd={() => {
                          setDraggedId(null);
                          setDragOverStage(null);
                          setDropTargetId(undefined);
                          setTimeout(() => {
                            wasDragging.current = false;
                          }, 0);
                        }}
                        className={`relative min-w-0 max-w-full cursor-grab overflow-visible rounded-md border border-l-4 bg-card p-3 shadow-xs hover:z-20 hover:shadow-md active:cursor-grabbing ${OPPORTUNITY_COLORS[item.color || "slate"].border} ${
                          dropTargetId?.endsWith(`:${item.id}`) &&
                          draggedId !== item.id
                            ? "ring-2 ring-primary/40"
                            : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="min-w-0 break-words text-sm font-semibold leading-snug [overflow-wrap:anywhere]">
                            {item.title}
                          </h3>
                          <div className="relative -mr-1 -mt-1 flex shrink-0 items-center">
                            <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={(event) => {
                                event.stopPropagation();
                                setColorMenuId((current) =>
                                  current === item.id ? undefined : item.id,
                                );
                              }}
                              className="h-7 w-7"
                              title="Choose opportunity color"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                            {colorMenuId === item.id && (
                              <div
                                className="absolute right-0 top-8 z-30 w-44 rounded-md border bg-popover p-3 text-popover-foreground shadow-lg"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <p className="mb-2 text-xs font-medium">
                                  Opportunity color
                                </p>
                                <div className="grid grid-cols-5 gap-2">
                                  {(
                                    Object.entries(OPPORTUNITY_COLORS) as Array<
                                      [
                                        OpportunityColor,
                                        (typeof OPPORTUNITY_COLORS)[OpportunityColor],
                                      ]
                                    >
                                  ).map(([color, style]) => (
                                    <button
                                      key={color}
                                      type="button"
                                      onClick={() =>
                                        void setOpportunityColor(item.id, color)
                                      }
                                      className={`h-6 w-6 rounded-full border-2 ${style.swatch} ${
                                        (item.color || "slate") === color
                                          ? "border-foreground"
                                          : "border-transparent"
                                      }`}
                                      title={color}
                                      aria-label={`Set ${color} color`}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {item.contact?.name || "Unknown contact"}
                          {item.company ? ` · ${item.company}` : ""}
                        </p>
                        <p className="mt-3 text-base font-semibold">
                          {formatMoney(item.value, item.currency)}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <div
                            className="flex"
                            aria-label={`Priority ${item.priority || 1} of 3`}
                          >
                            {[1, 2, 3].map((priority) => (
                              <button
                                key={priority}
                                type="button"
                                draggable={false}
                                onPointerDown={(event) =>
                                  event.stopPropagation()
                                }
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void updatePriority.mutateAsync({
                                    id: item.id,
                                    priority: priority as 1 | 2 | 3,
                                  });
                                }}
                                className="p-0.5"
                                title={`${priority === 1 ? "Low" : priority === 2 ? "Medium" : "High"} priority`}
                              >
                                <Star
                                  className={`h-4 w-4 ${priority <= (item.priority || 1) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
                                />
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            draggable={false}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              setScheduleForId(item.id);
                            }}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Schedule activity"
                          >
                            <CalendarPlus className="h-4 w-4" />
                          </button>
                        </div>
                        {(item.activities || []).some(
                          (activity) =>
                            activity.type === "planned" &&
                            !activity.completedAt,
                        ) && (
                          <div className="mt-2 flex flex-wrap items-center gap-1 border-t pt-2">
                            {(item.activities || [])
                              .filter(
                                (activity) =>
                                  activity.type === "planned" &&
                                  !activity.completedAt,
                              )
                              .slice(0, 5)
                              .map((activity) => {
                                const meta =
                                  ACTIVITY_CATEGORY_META[
                                    activity.category || "todo"
                                  ];
                                const ActivityIcon = meta.icon;
                                return (
                                  <span
                                    key={activity.id}
                                    className="group/activity relative flex h-6 w-6 items-center justify-center rounded border bg-background shadow-xs transition-colors hover:border-primary/35 hover:bg-muted"
                                  >
                                    <ActivityIcon
                                      className={`h-3.5 w-3.5 ${meta.iconColor}`}
                                    />
                                    <span className="pointer-events-none absolute bottom-full right-0 z-40 mb-2 w-60 translate-y-1 rounded-lg border bg-popover p-3 text-left text-popover-foreground opacity-0 shadow-xl transition-all duration-150 group-hover/activity:translate-y-0 group-hover/activity:opacity-100">
                                      <span className="mb-2 flex items-center justify-between gap-2">
                                        <span className="flex items-center gap-1.5 text-xs font-semibold">
                                          <ActivityIcon
                                            className={`h-3.5 w-3.5 ${meta.iconColor}`}
                                          />
                                          {meta.label}
                                        </span>
                                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-300">
                                          Scheduled
                                        </span>
                                      </span>
                                      <span className="block whitespace-pre-wrap break-words text-xs leading-5">
                                        {activity.content}
                                      </span>
                                      {activity.dueAt && (
                                        <span className="mt-2 flex items-center gap-1.5 border-t pt-2 text-[11px] text-muted-foreground">
                                          <CalendarDays className="h-3.5 w-3.5" />
                                          {new Date(
                                            activity.dueAt,
                                          ).toLocaleString(undefined, {
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </span>
                                      )}
                                      <span className="absolute -bottom-1.5 right-2.5 h-3 w-3 rotate-45 border-b border-r bg-popover" />
                                    </span>
                                  </span>
                                );
                              })}
                          </div>
                        )}
                        <div className="mt-3 grid gap-1.5 text-xs text-muted-foreground">
                          <p className="flex items-center gap-1.5">
                            <UserRound className="h-3.5 w-3.5" />
                            {item.owner?.name || "Unassigned"}
                          </p>
                          <p className="flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {item.expectedCloseAt
                              ? new Date(
                                  item.expectedCloseAt,
                                ).toLocaleDateString()
                              : "No close date"}
                          </p>
                        </div>
                        {item.nextAction && (
                          <p className="mt-3 min-w-0 break-words border-t pt-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                            <span className="font-medium text-foreground">
                              Next:
                            </span>{" "}
                            {item.nextAction}
                          </p>
                        )}
                      </motion.article>
                    ))}
                    {!isLoading && items.length === 0 && (
                      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground">
                        No opportunities in this stage
                      </div>
                    )}
                    <div
                      onDragOver={(event) => {
                        if (!draggedId || draggedStageId) return;
                        event.preventDefault();
                        event.stopPropagation();
                        event.dataTransfer.dropEffect = "move";
                        setDragOverStage(stage.id);
                        setDropTargetId(`bottom:${stage.id}`);
                      }}
                      onDrop={(event) => {
                        if (!draggedId || draggedStageId) return;
                        event.preventDefault();
                        event.stopPropagation();
                        drop(
                          event,
                          stage.id,
                          items.filter((item) => item.id !== draggedId).length,
                        );
                      }}
                      aria-label={`Drop opportunity at the bottom of ${stage.label}`}
                      className={`h-16 rounded-md transition-[background-color,box-shadow] duration-150 ${
                        draggedId && !draggedStageId
                          ? "pointer-events-auto"
                          : "pointer-events-none"
                      } ${
                        dropTargetId === `bottom:${stage.id}`
                          ? "bg-primary/10 ring-2 ring-inset ring-primary/30"
                          : "bg-transparent"
                      }`}
                    />
                  </div>
                </motion.section>
              );
            })}
            {canCustomizePipeline && stages.length < 15 && (
              <motion.button
                layout
                type="button"
                onClick={openNewStage}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="group relative flex h-36 w-20 shrink-0 flex-col items-center justify-center self-start overflow-hidden rounded-xl border bg-gradient-to-b from-card to-muted/30 px-2 text-center text-muted-foreground shadow-xs transition-colors hover:border-primary/40 hover:text-primary hover:shadow-md"
                title="Add pipeline stage"
              >
                <span className="absolute inset-y-3 left-0 w-0.5 rounded-r-full bg-primary/35 transition-colors group-hover:bg-primary" />
                <span className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-lg border bg-background text-foreground shadow-sm transition-all group-hover:border-primary/30 group-hover:bg-primary group-hover:text-primary-foreground">
                  <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                </span>
                <span className="text-xs font-semibold leading-4">
                  Add
                  <br />
                  stage
                </span>
                <span className="mt-1 text-[10px] text-muted-foreground/70">
                  New step
                </span>
              </motion.button>
            )}
          </div>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-225 text-sm">
              <thead className="border-b bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Opportunity</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Expected close</th>
                  <th className="px-4 py-3">Next action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() =>
                      navigate(`/dashboard/crm/pipeline/${item.id}`)
                    }
                    className="cursor-pointer hover:bg-muted/20"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.contact?.name || "Unknown contact"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={item.stage}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          void moveOpportunity(
                            item.id,
                            event.target.value,
                            opportunities.filter(
                              (opportunity) =>
                                opportunity.stage === event.target.value &&
                                opportunity.id !== item.id,
                            ).length,
                          )
                        }
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {stages.map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatMoney(item.value, item.currency)}
                    </td>
                    <td className="px-4 py-3">
                      {item.owner?.name || "Unassigned"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.expectedCloseAt
                        ? new Date(item.expectedCloseAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="max-w-64 truncate px-4 py-3 text-muted-foreground">
                      {item.nextAction || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!isLoading && filtered.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No opportunities match the current filters.
            </div>
          )}
        </Card>
      )}

      {createOpen && (
        <OpportunityDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          stages={stages}
          owners={owners}
        />
      )}
      {settingsOpen && pipeline && (
        <PipelineSettingsDialog
          key={settingsStageId || "new-stage"}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          pipeline={pipeline}
          stageId={settingsStageId}
          countsByStage={countsByStage}
        />
      )}
      <Dialog
        open={Boolean(scheduleForId)}
        onOpenChange={(open) => !open && setScheduleForId(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule an activity</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-5 gap-1 rounded-md bg-muted/40 p-1">
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
                      scheduleCategory === category ? "default" : "ghost"
                    }
                    onClick={() => setScheduleCategory(category)}
                    className="px-1 text-[11px]"
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
          <Textarea
            value={scheduleTitle}
            onChange={(event) => setScheduleTitle(event.target.value)}
            placeholder="Call, email, demo, follow-up…"
            className="resize-none"
          />
          <Input
            type="datetime-local"
            value={scheduleAt}
            onChange={(event) => setScheduleAt(event.target.value)}
          />
          <DialogFooter>
            <Button
              disabled={
                !scheduleTitle.trim() || !scheduleAt || addActivity.isPending
              }
              onClick={async () => {
                if (!scheduleForId) return;
                await addActivity.mutateAsync({
                  id: scheduleForId,
                  content: scheduleTitle.trim(),
                  dueAt: new Date(scheduleAt).toISOString(),
                  category: scheduleCategory,
                });
                setScheduleForId(undefined);
                setScheduleTitle("");
                setScheduleAt("");
                toast.success("Activity scheduled");
              }}
            >
              Schedule activity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
