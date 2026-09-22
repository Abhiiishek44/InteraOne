import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useUpdateSalesPipeline } from "../hooks/use-opportunities";
import type {
  PipelineStage,
  PipelineStageType,
  SalesPipeline,
} from "../types/types";

const TYPE_LABELS: Record<PipelineStageType, string> = {
  open: "Open",
  won: "Closed won",
  lost: "Closed lost",
};

interface PipelineSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipeline: SalesPipeline;
  stageId?: string;
  countsByStage: Map<string, number>;
}

export function PipelineSettingsDialog({
  open,
  onOpenChange,
  pipeline,
  stageId,
  countsByStage,
}: PipelineSettingsDialogProps) {
  const updatePipeline = useUpdateSalesPipeline();
  const existingStage = pipeline.stages.find((stage) => stage.id === stageId);
  const isCreating = !existingStage;
  const [draft, setDraft] = useState<PipelineStage>(() =>
    existingStage
      ? { ...existingStage }
      : {
          id: `stage-${Date.now().toString(36)}`,
          label: "New stage",
          color: "blue",
          type: "open",
          order: pipeline.stages.length,
        },
  );
  const count = existingStage ? countsByStage.get(existingStage.id) || 0 : 0;
  const sameTypeCount = pipeline.stages.filter(
    (stage) => stage.type === existingStage?.type,
  ).length;
  const cannotDelete =
    !existingStage ||
    count > 0 ||
    pipeline.stages.length <= 3 ||
    sameTypeCount <= 1;

  const saveStages = async (
    stages: PipelineStage[],
    successMessage: string,
  ) => {
    try {
      await updatePipeline.mutateAsync({
        name: pipeline.name,
        stages: stages.map((stage, order) => ({ ...stage, order })),
      });
      toast.success(successMessage);
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update stage",
      );
    }
  };

  const save = async () => {
    const label = draft.label.trim();
    if (!label) {
      toast.error("Stage name is required");
      return;
    }
    if (
      pipeline.stages.some(
        (stage) =>
          stage.id !== existingStage?.id &&
          stage.label.trim().toLowerCase() === label.toLowerCase(),
      )
    ) {
      toast.error("Stage names must be unique");
      return;
    }
    if (count > 0 && existingStage && draft.type !== existingStage.type) {
      toast.error("Move opportunities out before changing the stage type");
      return;
    }

    const nextStage = { ...draft, label };
    const withoutCurrent = pipeline.stages.filter(
      (stage) => stage.id !== existingStage?.id,
    );
    const insertionIndex = Math.min(nextStage.order, withoutCurrent.length);
    const nextStages = [...withoutCurrent];
    nextStages.splice(insertionIndex, 0, nextStage);

    const types = new Set(nextStages.map((stage) => stage.type));
    if (
      !(["open", "won", "lost"] as PipelineStageType[]).every((type) =>
        types.has(type),
      )
    ) {
      toast.error("Keep an open, closed won, and closed lost stage");
      return;
    }
    await saveStages(nextStages, isCreating ? "Stage added" : "Stage updated");
  };

  const remove = async () => {
    if (!existingStage || cannotDelete) return;
    await saveStages(
      pipeline.stages.filter((stage) => stage.id !== existingStage.id),
      "Stage deleted",
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isCreating
              ? "Add pipeline stage"
              : `Customize ${existingStage.label}`}
          </DialogTitle>
          <DialogDescription>
            Configure this stage without affecting the layout of other stages.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="stage-name">Stage name</Label>
            <Input
              id="stage-name"
              value={draft.label}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  label: event.target.value,
                }))
              }
              maxLength={60}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="stage-type">Stage type</Label>
            <select
              id="stage-type"
              value={draft.type}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  type: event.target.value as PipelineStageType,
                }))
              }
              disabled={count > 0}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="stage-position">Position</Label>
            <select
              id="stage-position"
              value={draft.order}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  order: Number(event.target.value),
                }))
              }
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {Array.from(
                { length: pipeline.stages.length + (isCreating ? 1 : 0) },
                (_, index) => (
                  <option key={index} value={index}>
                    Position {index + 1}
                  </option>
                ),
              )}
            </select>
          </div>
          {existingStage && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3">
              <div>
                <p className="text-sm font-medium">Delete this stage</p>
                <p className="text-xs text-muted-foreground">
                  {count > 0
                    ? `${count} opportunities must be moved first.`
                    : sameTypeCount <= 1
                      ? "This is the only stage of its type."
                      : "This action removes the empty stage."}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void remove()}
                disabled={cannotDelete || updatePipeline.isPending}
                className="text-muted-foreground hover:text-destructive"
                title="Delete stage"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void save()}
            disabled={updatePipeline.isPending}
          >
            {updatePipeline.isPending
              ? "Saving…"
              : isCreating
                ? "Add stage"
                : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
