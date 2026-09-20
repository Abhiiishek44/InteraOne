import { useMemo, useRef, useState, type DragEvent } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import {
  CalendarDays,
  CircleDollarSign,
  GripVertical,
  LayoutGrid,
  List,
  MoreVertical,
  Plus,
  Search,
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
import {
  useContacts,
  useContactOwners,
} from "@/domains/contacts/hooks/use-contacts";
import { authApi } from "@/domains/auth/api/auth.api";
import { OpportunityDialog } from "../components/opportunity-dialog";
import { PipelineSettingsDialog } from "../components/pipeline-settings-dialog";
import {
  useOpportunities,
  useSalesPipeline,
  useUpdateOpportunityColor,
  useUpdateOpportunityStage,
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
  const { data: contacts = [] } = useContacts();
  const { data: owners = [] } = useContactOwners();
  const updateStage = useUpdateOpportunityStage();
  const updateColor = useUpdateOpportunityColor();
  const updatePipeline = useUpdateSalesPipeline();
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsStageId, setSettingsStageId] = useState<string>();
  const [colorMenuId, setColorMenuId] = useState<string>();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [draggedStageId, setDraggedStageId] = useState<string>();
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
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

  const moveOpportunity = async (id: string, stage: string) => {
    const item = opportunities.find((opportunity) => opportunity.id === id);
    if (!item || item.stage === stage) return;
    try {
      await updateStage.mutateAsync({ id, stage });
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

  const drop = (event: DragEvent, stage: string) => {
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
    if (id) void moveOpportunity(id, stage);
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
        <div className="flex items-center gap-2">
          <Button onClick={openCreate} disabled={pipelineLoading}>
            <Plus className="mr-2 h-4 w-4" /> New opportunity
          </Button>
        </div>
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
          <div className="grid min-w-max grid-flow-col auto-cols-[minmax(270px,1fr)] items-start gap-2">
            {stages.map((stage) => {
              const items = filtered.filter((item) => item.stage === stage.id);
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
                  className={`flex h-128 min-w-0 flex-col overflow-hidden rounded-lg border bg-muted/10 transition-colors ${
                    dragOverStage === stage.id
                      ? "border-primary bg-primary/[0.04]"
                      : "border-x-border border-b-border"
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
                    className={`border-b bg-card/70 px-3 py-3 ${
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
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
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
                        onDragStart={() => {
                          wasDragging.current = true;
                          setDraggedStageId(undefined);
                          setDraggedId(item.id);
                        }}
                        onDragEnd={() => {
                          setDraggedId(null);
                          setDragOverStage(null);
                          setTimeout(() => {
                            wasDragging.current = false;
                          }, 0);
                        }}
                        className={`relative cursor-grab rounded-md border border-l-4 bg-card p-3 shadow-xs hover:shadow-md active:cursor-grabbing ${OPPORTUNITY_COLORS[item.color || "slate"].border}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold leading-snug">
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
                          <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">
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
                  </div>
                </motion.section>
              );
            })}
            {canCustomizePipeline && stages.length < 15 && (
              <motion.button
                layout
                type="button"
                onClick={() => openStageSettings()}
                className="flex h-128 min-w-0 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/5 px-6 text-center text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.03] hover:text-foreground"
              >
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border bg-background">
                  <Plus className="h-5 w-5" />
                </span>
                <span className="text-sm font-semibold">Add stage</span>
                <span className="mt-1 text-xs">
                  Create the next pipeline step
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
                          void moveOpportunity(item.id, event.target.value)
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
          contacts={contacts}
          owners={owners}
        />
      )}
      {settingsOpen && pipeline && (
        <PipelineSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          pipeline={pipeline}
          stageId={settingsStageId}
          countsByStage={countsByStage}
        />
      )}
    </div>
  );
}
