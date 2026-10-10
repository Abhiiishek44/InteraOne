import type { ComponentType, ReactNode } from "react";
import {
  CalendarDays,
  ChevronDown,
  FileText,
  Mail,
  Paperclip,
  Phone,
  StickyNote,
} from "lucide-react";
import { WhatsAppIcon } from "@/shared/ui/channel-icon";
import { Card, CardContent } from "@/shared/ui/card";

export type ActivityWorkspaceTab =
  | "activity"
  | "notes"
  | "call"
  | "whatsapp"
  | "email"
  | "files"
  | "documents";

export interface ActivityWorkspaceTabItem {
  id: ActivityWorkspaceTab;
  label: string;
  icon: ComponentType<{ className?: string }>;
  iconClass: string;
}

export const ACTIVITY_WORKSPACE_TABS: readonly ActivityWorkspaceTabItem[] = [
  {
    id: "activity",
    label: "Activity",
    icon: CalendarDays,
    iconClass: "text-blue-600",
  },
  {
    id: "notes",
    label: "Notes",
    icon: StickyNote,
    iconClass: "text-amber-500",
  },
  { id: "call", label: "Call", icon: Phone, iconClass: "text-sky-600" },
  { id: "whatsapp", label: "WhatsApp", icon: WhatsAppIcon, iconClass: "" },
  { id: "email", label: "Email", icon: Mail, iconClass: "text-rose-500" },
  {
    id: "files",
    label: "Files",
    icon: Paperclip,
    iconClass: "text-violet-600",
  },
  {
    id: "documents",
    label: "Documents",
    icon: FileText,
    iconClass: "text-indigo-600",
  },
] as const;

export function ActivityWorkspaceComposer({
  tab,
  onTabChange,
  flushContent = false,
  children,
}: {
  tab: ActivityWorkspaceTab;
  onTabChange: (tab: ActivityWorkspaceTab) => void;
  flushContent?: boolean;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex overflow-x-auto border-b border-border px-2">
        {ACTIVITY_WORKSPACE_TABS.map(({ id, label, icon: Icon, iconClass }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
              tab === id
                ? "border-primary bg-primary/[0.04] text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className={`h-4 w-4 ${iconClass}`} />
            {label}
          </button>
        ))}
      </div>
      <CardContent className={flushContent ? "p-0" : "p-5"}>
        {children}
      </CardContent>
    </Card>
  );
}

export function ActivityWorkspaceSectionHeader({
  title,
  expanded,
  onExpandedChange,
}: {
  title: string;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-semibold">
        {title} <ChevronDown className="h-4 w-4" />
      </h2>
      {typeof expanded === "boolean" && onExpandedChange ? (
        <button
          type="button"
          role="switch"
          aria-checked={expanded}
          onClick={() => onExpandedChange(!expanded)}
          className="flex items-center gap-2 rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span
            aria-hidden="true"
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
              expanded ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                expanded ? "translate-x-[18px]" : "translate-x-0.5"
              }`}
            />
          </span>
          <span>Expand all items</span>
        </button>
      ) : null}
    </div>
  );
}

export function ActivityWorkspaceHistoryCard({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Card className="overflow-visible">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-semibold">History</h2>
      </div>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

export function ActivityWorkspaceHistoryFilters<T extends string>({
  filters,
  active,
  onChange,
}: {
  filters: ReadonlyArray<{ id: T; label: string; count?: number }>;
  active: T;
  onChange: (filter: T) => void;
}) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto pb-2">
      {filters.map((filter) => (
        <button
          key={filter.id}
          type="button"
          onClick={() => onChange(filter.id)}
          className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            active === filter.id
              ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
              : "text-foreground hover:bg-muted"
          }`}
        >
          {filter.label}
          {typeof filter.count === "number" ? ` (${filter.count})` : ""}
        </button>
      ))}
    </div>
  );
}

export function ActivityWorkspaceEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
