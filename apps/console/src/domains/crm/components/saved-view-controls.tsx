import { useState } from "react";
import { Bookmark, Save, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { DeleteConfirmDialog } from "@/shared/components/delete-confirm-dialog";
import {
  useCreateSavedView,
  useDeleteSavedView,
  useSavedViews,
  useUpdateSavedView,
} from "../hooks/use-saved-views";
import type { SavedViewEntity, SavedViewState } from "../types/saved-view";

interface SavedViewControlsProps {
  entityType: SavedViewEntity;
  state: SavedViewState;
  onApply: (state: SavedViewState) => void;
}

export function SavedViewControls({
  entityType,
  state,
  onApply,
}: SavedViewControlsProps) {
  const { data: views = [] } = useSavedViews(entityType);
  const createView = useCreateSavedView(entityType);
  const updateView = useUpdateSavedView(entityType);
  const deleteView = useDeleteSavedView(entityType);
  const [activeViewId, setActiveViewId] = useState<string>();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState("");
  const activeView = views.find((view) => view.id === activeViewId);
  const isModified = Boolean(
    activeView && JSON.stringify(activeView.state) !== JSON.stringify(state),
  );

  const applyView = (id: string) => {
    if (id === "current") {
      setActiveViewId(undefined);
      return;
    }
    const selected = views.find((view) => view.id === id);
    if (!selected) return;
    setActiveViewId(selected.id);
    onApply(selected.state);
  };

  const saveNewView = async () => {
    if (!name.trim()) return;
    try {
      const created = await createView.mutateAsync({
        name: name.trim(),
        state,
      });
      setActiveViewId(created.id);
      setName("");
      setCreateOpen(false);
      toast.success("View saved");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save view",
      );
    }
  };

  const updateActiveView = async () => {
    if (!activeView) return;
    try {
      await updateView.mutateAsync({ id: activeView.id, state });
      toast.success("Saved view updated");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update view",
      );
    }
  };

  const deleteActiveView = async () => {
    if (!activeView) return;
    try {
      await deleteView.mutateAsync(activeView.id);
      setActiveViewId(undefined);
      setDeleteOpen(false);
      toast.success("Saved view deleted");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete view",
      );
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={activeViewId || "current"} onValueChange={applyView}>
          <SelectTrigger className="w-52">
            <Bookmark className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Saved views" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Current filters</SelectItem>
            {views.map((view) => (
              <SelectItem key={view.id} value={view.id}>
                {view.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activeView && isModified && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void updateActiveView()}
            disabled={updateView.isPending}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" /> Update
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCreateOpen(true)}
        >
          Save as new
        </Button>
        {activeView && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setDeleteOpen(true)}
            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            title="Delete saved view"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        {activeView && isModified && (
          <span className="text-xs text-muted-foreground">Modified</span>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save current view</DialogTitle>
            <DialogDescription>
              Save the current filters and display settings for one-click use.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`${entityType}-view-name`}>View name</Label>
            <Input
              id={`${entityType}-view-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="My follow-ups"
              maxLength={60}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void saveNewView()}
              disabled={!name.trim() || createView.isPending}
            >
              {createView.isPending ? "Saving…" : "Save view"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void deleteActiveView()}
        title="Delete saved view"
        itemName={activeView?.name}
        isDeleting={deleteView.isPending}
      />
    </>
  );
}
