import { useState } from "react";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const LABEL_SWATCHES = [
  { id: "blue", dot: "bg-blue-500", badge: "bg-blue-600 text-white" },
  { id: "mint", dot: "bg-emerald-300", badge: "bg-emerald-300 text-emerald-950" },
  { id: "yellow", dot: "bg-yellow-400", badge: "bg-yellow-300 text-yellow-950" },
  { id: "red", dot: "bg-red-500", badge: "bg-red-500 text-white" },
  { id: "purple", dot: "bg-fuchsia-600", badge: "bg-fuchsia-600 text-white" },
  { id: "gray", dot: "bg-gray-300", badge: "bg-gray-300 text-gray-900" },
  { id: "brown", dot: "bg-amber-700", badge: "bg-amber-700 text-white" },
  { id: "orange", dot: "bg-orange-400", badge: "bg-orange-400 text-orange-950" },
  { id: "slate", dot: "bg-slate-500", badge: "bg-slate-500 text-white" },
  { id: "pink", dot: "bg-pink-400", badge: "bg-pink-400 text-pink-950" },
] as const;

const fallbackColors = [
  "bg-red-500 text-white",
  "bg-emerald-300 text-emerald-950",
  "bg-yellow-300 text-yellow-950",
  "bg-blue-600 text-white",
  "bg-violet-500 text-white",
  "bg-cyan-300 text-cyan-950",
];

function labelBadgeClass(label: string) {
  let savedColors: Record<string, string> = {};
  try {
    savedColors = JSON.parse(
      window.localStorage.getItem("contact-label-colors") || "{}",
    );
  } catch {
    savedColors = {};
  }
  return (
    LABEL_SWATCHES.find((swatch) => swatch.id === savedColors[label])?.badge ||
    fallbackColors[
      Math.abs(
        [...label].reduce(
          (total, character) => total + character.charCodeAt(0),
          0,
        ),
      ) % fallbackColors.length
    ]
  );
}

export function LabelBadge({ label }: { label: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${labelBadgeClass(label)}`}
    >
      {label}
    </span>
  );
}

export function LabelPicker({
  value,
  options,
  onChange,
  disabled = false,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = value
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);

  if (open) {
    return (
      <LabelEditor
        value={value}
        options={options}
        onChange={onChange}
        onCollapse={() => setOpen(false)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      disabled={disabled}
      className="flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="flex min-w-0 flex-wrap gap-1">
        {selected.length ? (
          selected.map((label) => <LabelBadge key={label} label={label} />)
        ) : (
          <span className="text-muted-foreground">Add labels</span>
        )}
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

export function LabelEditor({
  value,
  options,
  onChange,
  onCollapse,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onCollapse?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] =
    useState<(typeof LABEL_SWATCHES)[number]["id"]>("blue");
  const selected = value
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
  const availableLabels = Array.from(new Set([...options, ...selected])).filter(
    (label) => label.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const updateSelected = (labels: string[]) => onChange(labels.join(", "));
  const addCustomLabel = () => {
    const label = newLabelName.trim();
    if (!label) return;
    let savedColors: Record<string, string> = {};
    try {
      savedColors = JSON.parse(
        window.localStorage.getItem("contact-label-colors") || "{}",
      );
    } catch {
      savedColors = {};
    }
    window.localStorage.setItem(
      "contact-label-colors",
      JSON.stringify({ ...savedColors, [label]: newLabelColor }),
    );
    updateSelected(Array.from(new Set([...selected, label])));
    setSearch("");
    setNewLabelName("");
    setCreating(false);
  };

  return (
    <div className="overflow-hidden rounded-md border border-input bg-background">
      <button
        type="button"
        onClick={onCollapse}
        className="flex min-h-10 w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex min-w-0 flex-wrap gap-1">
          {selected.length ? (
            selected.map((label) => (
              <LabelBadge key={label} label={label} />
            ))
          ) : (
            <span className="text-sm text-muted-foreground">Add labels</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 rotate-180 text-muted-foreground" />
      </button>

      {creating ? (
        <div className="space-y-4 border-t p-3">
          <div className="space-y-1.5">
            <Label>Label name</Label>
            <Input
              autoFocus
              value={newLabelName}
              onChange={(event) => setNewLabelName(event.target.value)}
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
            <Button type="button" variant="outline" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={addCustomLabel} disabled={!newLabelName.trim()}>
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
                  <LabelBadge label={label} />
                  {isSelected && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
            {!availableLabels.length && (
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
            <Plus className="h-4 w-4" /> Add label
          </button>
        </>
      )}
    </div>
  );
}
