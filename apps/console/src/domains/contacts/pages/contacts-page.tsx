import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Label } from "@/shared/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Plus,
  Search,
  SlidersHorizontal,
  Users,
  AlertTriangle,
  Loader2,
  Tag,
  Building2,
  CalendarClock,
  CircleCheckBig,
  CircleDotDashed,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Mail,
  Pencil,
  Phone,
  UserRound,
} from "lucide-react";
import { ContactDialog } from "@/domains/contacts/components/contact-form";
import {
  usePendingConflicts,
  useResolveConflict,
  useDeleteContacts,
  useBulkAddTags,
  useCreateContact,
  useContactOwners,
  useContactsPage,
  useUpdateContact,
} from "../hooks/use-contacts";
import type {
  ContactListItem,
  Contact,
  ContactWritePayload,
} from "../types/types";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/shared/ui/pagination";
import { DeleteConfirmDialog } from "@/shared/components/delete-confirm-dialog";
import {
  useCrmRecords,
  useSalesPipeline,
} from "@/domains/crm/hooks/use-crm-records";

const TAG_OPTIONS = ["VIP", "Enterprise", "Trial", "Billing", "At Risk"];
const SORT_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "recent", label: "Most recent activity" },
  { value: "conversations", label: "Conversations" },
  { value: "created", label: "Date created" },
];

const FILTER_ACTIVITY = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

const FILTER_CONVERSATIONS = [
  { value: "1-2", label: "1-2 conversations" },
  { value: "3-10", label: "3-10 conversations" },
  { value: "10+", label: "10+ conversations" },
];

const SOURCE_OPTIONS = [
  { value: "facebook_lead_ads", label: "Facebook Lead Ads" },
  { value: "google_forms", label: "Google Forms" },
  { value: "manual", label: "Manually added" },
  { value: "widget", label: "Website widget" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "phone", label: "Phone" },
  { value: "qr", label: "QR code" },
];

const formatSourceLabel = (value: string) =>
  SOURCE_OPTIONS.find((option) => option.value === value)?.label ||
  value.replaceAll("_", " ");

const toContactViewModel = (item: ContactListItem): Contact => ({
  id: item.id,
  name: item.name,
  email: item.email,
  phone: item.phone,
  company: item.company,
  tags: item.tags || [],
  lifecycleStage: item.lifecycleStage || "new",
  leadStatus: item.leadStatus || "needs_review",
  owner: item.owner || null,
  acquisitionSource: item.acquisitionSource || "unknown",
  integrationSources: item.integrationSources || [],
  preferredChannel: item.preferredChannel || null,
  nextFollowUpAt: item.nextFollowUpAt || null,
  lastContactedAt: item.lastContactedAt || null,
  lastActivity: item.lastActivity,
  createdAt: item.createdAt,
  isOnline: false,
  conversationCount: item.conversationCount,
  notes: item.notes || [],
  conversations:
    item.conversations && item.conversations.length > 0
      ? item.conversations
      : [
          {
            id: `conv-${item.id}`,
            status: "open",
            lastMessage: "Conversation context is still syncing.",
            channel: "widget",
            updatedAt: item.updatedAt,
          },
        ],
  insights: {
    summary:
      item.insights?.summary ||
      "No insights yet. Continue conversations to generate AI insights.",
    sentiment: item.insights?.sentiment || "neutral",
    topics: item.insights?.topics || [],
  },
  conflicts: item.conflicts || [],
  customFields: item.customFields || {},
});

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const lifecycleStyle = (stage: Contact["lifecycleStage"]) => {
  if (stage === "customer")
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (stage === "opportunity")
    return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300";
  if (stage === "qualified")
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300";
  if (stage === "inactive" || stage === "lost")
    return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
};

const isRecentlyActive = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  return diff < 30 * 60 * 1000;
};

type EditableContactField = "name" | "company" | "email" | "phone" | "ownerId";
type ContactColumnId =
  | "contact"
  | "organization"
  | "email"
  | "phone"
  | "openDeals"
  | "wonDeals"
  | "nextActivity"
  | "owner";

const CONTACT_COLUMNS: Record<
  ContactColumnId,
  { label: string; width: string }
> = {
  contact: { label: "Contact", width: "minmax(280px,1.4fr)" },
  organization: { label: "Organization", width: "minmax(210px,1fr)" },
  email: { label: "Email", width: "minmax(255px,1.2fr)" },
  phone: { label: "Phone", width: "minmax(180px,.8fr)" },
  openDeals: { label: "Open deals", width: "155px" },
  wonDeals: { label: "Won deals", width: "155px" },
  nextActivity: { label: "Next activity", width: "minmax(210px,1fr)" },
  owner: { label: "Owner", width: "minmax(200px,.9fr)" },
};
const DEFAULT_CONTACT_COLUMN_ORDER = Object.keys(
  CONTACT_COLUMNS,
) as ContactColumnId[];

type InlineEditor = {
  contact: Contact;
  field: EditableContactField;
  value: string;
};

const INLINE_FIELD_LABELS: Record<EditableContactField, string> = {
  name: "name",
  company: "organization",
  email: "email",
  phone: "phone",
  ownerId: "owner",
};

function EditableContactCell({
  contact,
  field,
  editor,
  onEdit,
  onCancel,
  onChange,
  onSave,
  onOpenContact,
  saving,
  ownerOptions,
  className,
  order,
  children,
}: {
  contact: Contact;
  field: EditableContactField;
  editor: InlineEditor | null;
  onEdit: (
    event: MouseEvent,
    contact: Contact,
    field: EditableContactField,
  ) => void;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSave: () => Promise<void>;
  onOpenContact?: () => void;
  saving: boolean;
  ownerOptions: Array<{ id: string; name: string }>;
  className?: string;
  order?: number;
  children: ReactNode;
}) {
  const isEditing = editor?.contact.id === contact.id && editor.field === field;
  const label = INLINE_FIELD_LABELS[field];

  return (
    <div
      className={`relative h-full min-w-0 border-r border-border/40 ${className || ""}`}
      style={{ order }}
    >
      {onOpenContact ? (
        <div className="group flex h-full min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenContact();
            }}
            className="min-w-0 flex-1 rounded px-1 py-1 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            title="Open contact details"
          >
            {children}
          </button>
          <button
            type="button"
            onClick={(event) => onEdit(event, contact, field)}
            className="shrink-0 rounded p-1 text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            title={`Edit ${label}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={(event) => onEdit(event, contact, field)}
          className="group flex h-full w-full min-w-0 items-center gap-1 rounded px-1 py-1 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          title={`Edit ${label}`}
        >
          {children}
          <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        </button>
      )}

      {isEditing && (
        <form
          className={`absolute z-50 w-64 rounded-xl border border-border bg-background p-3 shadow-xl ${
            field === "ownerId"
              ? "right-1 top-full mt-1"
              : "left-1 top-full mt-1"
          }`}
          onClick={(event) => event.stopPropagation()}
          onSubmit={(event) => {
            event.preventDefault();
            void onSave();
          }}
        >
          <Label className="mb-2 block text-sm font-medium">Edit {label}</Label>
          {field === "ownerId" ? (
            <Select
              value={editor.value || "unassigned"}
              onValueChange={(nextValue) =>
                onChange(nextValue === "unassigned" ? "" : nextValue)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {ownerOptions.map((owner) => (
                  <SelectItem key={owner.id} value={owner.id}>
                    {owner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              autoFocus
              type={field === "email" ? "email" : "text"}
              value={editor.value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={`Enter ${label}`}
            />
          )}
          <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={onCancel}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving || (field === "name" && !editor.value.trim())}
              className="cursor-pointer"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function ContactsPage() {
  const navigate = useNavigate();
  const [isConflictSheetOpen, setIsConflictSheetOpen] = useState(false);
  const [focusedConflictContactId, setFocusedConflictContactId] = useState<
    string | null
  >(null);
  const [searchValue, setSearchValue] = useState("");
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [conversationFilter, setConversationFilter] = useState<string>("all");
  const [lifecycleFilter, setLifecycleFilter] = useState<string>("all");
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sortValue, setSortValue] = useState("recent");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkTagDialogOpen, setIsBulkTagDialogOpen] = useState(false);
  const [bulkTagsInput, setBulkTagsInput] = useState("");
  const [inlineEditor, setInlineEditor] = useState<InlineEditor | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<ContactColumnId | null>(
    null,
  );
  const [columnOrder, setColumnOrder] = useState<ContactColumnId[]>(() => {
    try {
      const saved = JSON.parse(
        window.localStorage.getItem("contacts-column-order") || "[]",
      ) as ContactColumnId[];
      return saved.length === DEFAULT_CONTACT_COLUMN_ORDER.length &&
        DEFAULT_CONTACT_COLUMN_ORDER.every((id) => saved.includes(id))
        ? saved
        : DEFAULT_CONTACT_COLUMN_ORDER;
    } catch {
      return DEFAULT_CONTACT_COLUMN_ORDER;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(
      "contacts-column-order",
      JSON.stringify(columnOrder),
    );
  }, [columnOrder]);

  const moveColumn = (source: ContactColumnId, targetIndex: number) => {
    setColumnOrder((current) => {
      const sourceIndex = current.indexOf(source);
      if (sourceIndex < 0) return current;
      const next = [...current];
      next.splice(sourceIndex, 1);
      next.splice(Math.max(0, Math.min(targetIndex, next.length)), 0, source);
      return next;
    });
  };
  const columnPosition = (id: ContactColumnId) => columnOrder.indexOf(id);
  const columnGridTemplate = columnOrder
    .map((id) => CONTACT_COLUMNS[id].width)
    .join(" ");

  const {
    data: contactsPage,
    isLoading: isLoadingContacts,
    error: loadErrorData,
  } = useContactsPage({
    search: searchValue,
    page: currentPage,
    limit: 10,
    lifecycleStage: lifecycleFilter,
    leadStatus: leadStatusFilter,
    acquisitionSource: sourceFilter,
    tags: tagFilters,
    activityRange: activityFilter,
    conversationRange: conversationFilter,
    sort: sortValue,
  });
  const { data: conflicts = [] } = usePendingConflicts();
  const { data: deals = [] } = useCrmRecords();
  const { data: pipeline } = useSalesPipeline();

  const resolveConflictMutation = useResolveConflict();
  const deleteContactsMutation = useDeleteContacts();
  const bulkAddTagsMutation = useBulkAddTags();
  const createContactMutation = useCreateContact();
  const updateContactMutation = useUpdateContact();
  const { data: ownerOptions = [] } = useContactOwners();

  const loadError = loadErrorData ? loadErrorData.message : "";

  const contacts = useMemo(
    () => (contactsPage?.contacts || []).map(toContactViewModel),
    [contactsPage?.contacts],
  );

  const filteredContacts = contacts;
  const displayedContacts = contacts;
  const paginatedContacts = contacts;
  const totalItems = contactsPage?.total || 0;
  const totalPages = contactsPage?.totalPages || 1;
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * 10 + 1;
  const endItem = Math.min(currentPage * 10, totalItems);
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }
    const pages: Array<number | string> = [1];
    if (currentPage > 3) pages.push("...");
    for (
      let page = Math.max(2, currentPage - 1);
      page <= Math.min(totalPages - 1, currentPage + 1);
      page += 1
    ) {
      pages.push(page);
    }
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  }, [currentPage, totalPages]);
  const goToPage = (page: number) =>
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  const goToNext = () => goToPage(currentPage + 1);
  const goPrev = () => goToPage(currentPage - 1);

  const openInlineEditor = (
    event: MouseEvent,
    contact: Contact,
    field: EditableContactField,
  ) => {
    event.stopPropagation();
    const values: Record<EditableContactField, string> = {
      name: contact.name,
      company: contact.company || "",
      email: contact.email || "",
      phone: contact.phone || "",
      ownerId: contact.owner?.id || "",
    };
    setInlineEditor({ contact, field, value: values[field] });
  };

  const saveInlineEditor = async () => {
    if (!inlineEditor) return;
    const { contact, field, value } = inlineEditor;
    if (field === "name" && !value.trim()) return;
    try {
      await updateContactMutation.mutateAsync({
        id: contact.id,
        [field]: field === "ownerId" ? value || null : value.trim(),
      });
      setInlineEditor(null);
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to update contact",
      );
    }
  };

  const dealCountsByContact = useMemo(() => {
    const stageTypes = new Map(
      (pipeline?.stages || []).map((stage) => [stage.id, stage.type]),
    );
    const counts = new Map<string, { open: number; closed: number }>();

    deals.forEach((deal) => {
      const contactId = deal.contact?.id;
      if (!contactId) return;
      const current = counts.get(contactId) || { open: 0, closed: 0 };
      const stageType = stageTypes.get(deal.stage);
      const isClosed =
        stageType === "won" ||
        stageType === "lost" ||
        /won|lost|closed/i.test(deal.stage);
      if (isClosed) current.closed += 1;
      else current.open += 1;
      counts.set(contactId, current);
    });

    return counts;
  }, [deals, pipeline]);

  useEffect(() => {
    const timeout = setTimeout(() => setCurrentPage(1), 0);
    return () => clearTimeout(timeout);
  }, [
    searchValue,
    tagFilters,
    activityFilter,
    conversationFilter,
    lifecycleFilter,
    leadStatusFilter,
    sourceFilter,
    sortValue,
  ]);

  useEffect(() => {
    const timeout = setTimeout(() => setSelectedContacts([]), 0);
    return () => clearTimeout(timeout);
  }, [
    currentPage,
    searchValue,
    tagFilters,
    activityFilter,
    conversationFilter,
    lifecycleFilter,
    leadStatusFilter,
    sourceFilter,
    sortValue,
  ]);

  useEffect(() => {
    if (!contactsPage || contactsPage.page === currentPage) return;
    const timeout = setTimeout(() => setCurrentPage(contactsPage.page), 0);
    return () => clearTimeout(timeout);
  }, [contactsPage, currentPage]);

  const toggleBulkSelect = (id: string) => {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    const allFilteredSelected = filteredContacts.every((contact) =>
      selectedContacts.includes(contact.id),
    );
    if (allFilteredSelected) {
      const filteredIds = new Set(
        filteredContacts.map((contact) => contact.id),
      );
      setSelectedContacts((current) =>
        current.filter((contactId) => !filteredIds.has(contactId)),
      );
    } else {
      setSelectedContacts((current) => [
        ...new Set([
          ...current,
          ...filteredContacts.map((contact) => contact.id),
        ]),
      ]);
    }
  };

  const handleAddContact = async (
    payload: ContactWritePayload & { name: string; tags: string[] },
  ) => {
    try {
      const created = await createContactMutation.mutateAsync(payload);
      const createdId = created?._id || created?.id;
      if (createdId) navigate(`/dashboard/crm/contacts/${createdId}`);
    } catch (err) {
      throw err instanceof Error ? err : new Error("Failed to create contact");
    }
  };

  const clearFilters = () => {
    setSearchValue("");
    setTagFilters([]);
    setActivityFilter("all");
    setConversationFilter("all");
    setLifecycleFilter("all");
    setLeadStatusFilter("all");
    setSourceFilter("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    searchValue.trim() ||
    tagFilters.length > 0 ||
    activityFilter !== "all" ||
    conversationFilter !== "all" ||
    lifecycleFilter !== "all" ||
    leadStatusFilter !== "all" ||
    sourceFilter !== "all",
  );
  const activeFilterCount =
    tagFilters.length +
    Number(activityFilter !== "all") +
    Number(conversationFilter !== "all") +
    Number(lifecycleFilter !== "all") +
    Number(leadStatusFilter !== "all") +
    Number(sourceFilter !== "all");

  const handleBulkDelete = async () => {
    if (selectedContacts.length === 0) return;
    try {
      await deleteContactsMutation.mutateAsync(selectedContacts);
      setSelectedContacts([]);
      setIsDeleteDialogOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete contacts");
    }
  };

  const handleBulkAddTags = async () => {
    if (selectedContacts.length === 0) return;
    const tagsToAdd = bulkTagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tagsToAdd.length === 0) return;
    try {
      await bulkAddTagsMutation.mutateAsync({
        ids: selectedContacts,
        tags: tagsToAdd,
      });
      setSelectedContacts([]);
      setBulkTagsInput("");
      setIsBulkTagDialogOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add tags");
    }
  };

  const handleBulkExport = () => {
    if (selectedContacts.length === 0) return;
    const selected = contacts.filter((c) => selectedContacts.includes(c.id));
    const headers = [
      "Name",
      "Email",
      "Phone",
      "Organization",
      "Source",
      "Source form",
      "Tags",
      "Conversation Count",
      "Last Activity",
      "Created At",
    ];
    const csvRows = [headers.join(",")];

    for (const c of selected) {
      const row = [
        `"${(c.name || "").replace(/"/g, '""')}"`,
        `"${(c.email || "").replace(/"/g, '""')}"`,
        `"${(c.phone || "").replace(/"/g, '""')}"`,
        `"${(c.company || "").replace(/"/g, '""')}"`,
        `"${(c.integrationSources[0]?.providerLabel || formatSourceLabel(c.acquisitionSource)).replace(/"/g, '""')}"`,
        `"${(c.integrationSources[0]?.formName || "").replace(/"/g, '""')}"`,
        `"${(c.tags || []).join("; ").replace(/"/g, '""')}"`,
        c.conversationCount || 0,
        c.lastActivity,
        c.createdAt,
      ];
      csvRows.push(row.join(","));
    }

    const csvContent = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `contacts_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResolveConflict = async (
    conflictId: string,
    action: "apply" | "dismiss",
  ) => {
    try {
      await resolveConflictMutation.mutateAsync({ conflictId, action });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to resolve conflict");
    }
  };

  return (
    <div className="space-y-5">
      <header
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        data-tour-id="page-contacts-heading"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
            {!isLoadingContacts && (
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {totalItems}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage people, organizations, and customer relationships.
          </p>
          {loadError && (
            <p className="mt-1.5 text-xs text-amber-600">
              Contacts could not be refreshed: {loadError}
            </p>
          )}
        </div>
        <div data-tour-id="page-contacts-primary-action">
          <ContactDialog
            mode="create"
            onSubmit={handleAddContact}
            triggerType="custom"
            customTrigger={
              <Button className="w-full cursor-pointer sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Add contact
              </Button>
            }
          />
        </div>
      </header>

      <Card
        className="min-w-0 overflow-hidden"
        data-tour-id="page-contacts-list"
      >
        <CardHeader className="space-y-0 border-b p-0">
          <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
            <div className="flex min-w-[130px] items-center gap-2 font-semibold">
              <Users className="h-4 w-4 text-primary" />
              <span>{totalItems} contacts</span>
            </div>
            <div
              className="relative min-w-0 flex-1"
              data-tour-id="page-contacts-search"
            >
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search contacts by name, email, phone, or organization"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                className="h-10 cursor-text bg-muted/30 pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={
                  filtersExpanded || activeFilterCount ? "secondary" : "outline"
                }
                className="relative flex-1 cursor-pointer lg:flex-none"
                onClick={() => setFiltersExpanded((current) => !current)}
                aria-expanded={filtersExpanded}
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
              <Select value={sortValue} onValueChange={setSortValue}>
                <SelectTrigger className="w-[190px] cursor-pointer">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filtersExpanded && (
            <div
              className="border-t bg-muted/20 p-4"
              data-tour-id="page-contacts-filters"
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Lifecycle stage
                  </Label>
                  <Select
                    value={lifecycleFilter}
                    onValueChange={setLifecycleFilter}
                  >
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All stages</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="opportunity">Opportunity</SelectItem>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Lead status
                  </Label>
                  <Select
                    value={leadStatusFilter}
                    onValueChange={setLeadStatusFilter}
                  >
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="needs_review">Needs review</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="follow_up">Follow-up</SelectItem>
                      <SelectItem value="converted">Converted</SelectItem>
                      <SelectItem value="unqualified">Unqualified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Contact source
                  </Label>
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sources</SelectItem>
                      {SOURCE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Last activity
                  </Label>
                  <Select
                    value={activityFilter}
                    onValueChange={setActivityFilter}
                  >
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any time</SelectItem>
                      {FILTER_ACTIVITY.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Conversations
                  </Label>
                  <Select
                    value={conversationFilter}
                    onValueChange={setConversationFilter}
                  >
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue placeholder="Select volume" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any volume</SelectItem>
                      {FILTER_CONVERSATIONS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2 lg:col-span-3 xl:col-span-6">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-xs text-muted-foreground">
                      Labels
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 cursor-pointer px-2 text-xs"
                      onClick={clearFilters}
                      disabled={!hasActiveFilters}
                    >
                      Clear all
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {TAG_OPTIONS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          setTagFilters((prev) =>
                            prev.includes(tag)
                              ? prev.filter((item) => item !== tag)
                              : [...prev, tag],
                          )
                        }
                        className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          tagFilters.includes(tag)
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-5">
          {conflicts.length > 0 && (
            <button
              onClick={() => {
                setFocusedConflictContactId(null);
                setIsConflictSheetOpen(true);
              }}
              className="w-full bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-3 flex items-center justify-between text-sm text-amber-800 dark:text-amber-300 hover:bg-amber-100/50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer font-medium"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                <span>{conflicts.length} Pending Profile Conflicts</span>
              </div>
              <span className="text-xs underline">Review conflicts</span>
            </button>
          )}

          {selectedContacts.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border p-3">
              <div className="text-sm text-muted-foreground">
                {selectedContacts.length} contacts selected
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBulkTagDialogOpen(true)}
                  className="cursor-pointer"
                >
                  Add tags
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkExport}
                  className="cursor-pointer"
                >
                  Export
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="cursor-pointer"
                >
                  Delete
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={
                  filteredContacts.length > 0 &&
                  filteredContacts.every((contact) =>
                    selectedContacts.includes(contact.id),
                  )
                }
                onChange={toggleSelectAll}
                className="accent-primary cursor-pointer"
              />
              Select page
            </label>
            <span>
              Showing {startItem}-{endItem} of {totalItems} results
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/80 bg-background shadow-sm">
            <div className="min-w-[1720px]">
              <div
                className="grid items-stretch border-b-2 border-primary/20 bg-slate-100/90 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
                style={{ gridTemplateColumns: `48px ${columnGridTemplate}` }}
              >
                <span className="border-r border-border/60 px-4 py-4" />
                {columnOrder.map((columnId, index) => {
                  const HeaderIcon =
                    columnId === "contact"
                      ? UserRound
                      : columnId === "organization"
                        ? Building2
                        : columnId === "email"
                          ? Mail
                          : columnId === "phone"
                            ? Phone
                            : columnId === "openDeals"
                              ? CircleDotDashed
                              : columnId === "wonDeals"
                                ? CircleCheckBig
                                : columnId === "nextActivity"
                                  ? CalendarClock
                                  : UserRound;
                  return (
                    <div
                      key={columnId}
                      draggable
                      onDragStart={(event) => {
                        setDraggedColumn(columnId);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setDraggedColumn(null)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (draggedColumn && draggedColumn !== columnId)
                          moveColumn(draggedColumn, index);
                        setDraggedColumn(null);
                      }}
                      className={`group flex cursor-grab items-center gap-1 border-r border-border/60 px-2 py-3 last:border-r-0 active:cursor-grabbing ${draggedColumn === columnId ? "bg-primary/10 opacity-60" : "hover:bg-primary/[0.05]"}`}
                    >
                      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                      <HeaderIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate">
                        {CONTACT_COLUMNS[columnId].label}
                      </span>
                      <span className="hidden shrink-0 group-hover:flex group-focus-within:flex">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveColumn(columnId, index - 1)}
                          className="rounded p-0.5 hover:bg-background disabled:opacity-20"
                          aria-label={`Move ${CONTACT_COLUMNS[columnId].label} left`}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === columnOrder.length - 1}
                          onClick={() => moveColumn(columnId, index + 1)}
                          className="rounded p-0.5 hover:bg-background disabled:opacity-20"
                          aria-label={`Move ${CONTACT_COLUMNS[columnId].label} right`}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col">
                {paginatedContacts.map((contact) => {
                  const isSelected = selectedContacts.includes(contact.id);
                  const dealCounts = dealCountsByContact.get(contact.id) || {
                    open: 0,
                    closed: 0,
                  };
                  return (
                    <div
                      key={contact.id}
                      className={`relative grid min-h-[68px] grid-cols-[48px_minmax(0,1fr)] text-left transition-all select-none border-b border-border/70 last:border-b-0 ${
                        isSelected
                          ? "bg-primary/[0.07] shadow-[inset_3px_0_0_hsl(var(--primary))]"
                          : "hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-center border-r border-border/40 px-3 py-4">
                        <input
                          type="checkbox"
                          aria-label={`Select ${contact.name} for bulk actions`}
                          checked={selectedContacts.includes(contact.id)}
                          onChange={() => toggleBulkSelect(contact.id)}
                          className="accent-primary cursor-pointer"
                        />
                      </div>
                      <div
                        className="grid min-w-0 text-left"
                        style={{ gridTemplateColumns: columnGridTemplate }}
                      >
                        <EditableContactCell
                          contact={contact}
                          field="name"
                          editor={inlineEditor}
                          onEdit={openInlineEditor}
                          onCancel={() => setInlineEditor(null)}
                          onChange={(value) =>
                            setInlineEditor((current) =>
                              current ? { ...current, value } : null,
                            )
                          }
                          onSave={saveInlineEditor}
                          onOpenContact={() =>
                            navigate(`/dashboard/crm/contacts/${contact.id}`)
                          }
                          saving={updateContactMutation.isPending}
                          ownerOptions={ownerOptions}
                          order={columnPosition("contact")}
                          className="min-w-0 px-4 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="relative shrink-0">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-sm font-semibold text-primary-foreground shadow-sm">
                                {contact.name
                                  .split(" ")
                                  .map((part) => part[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${contact.isOnline ? "bg-emerald-500" : isRecentlyActive(contact.lastActivity) ? "bg-amber-400" : "bg-slate-300 dark:bg-slate-600"}`}
                                title={
                                  contact.isOnline
                                    ? "Online"
                                    : "Recently active"
                                }
                              />
                            </div>
                            <div className="min-w-0">
                              <h3 className="truncate font-semibold text-foreground">
                                {contact.name}
                              </h3>
                              <div className="mt-1 flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className={`h-5 px-1.5 text-[10px] font-medium capitalize ${lifecycleStyle(contact.lifecycleStage)}`}
                                >
                                  {contact.lifecycleStage}
                                </Badge>
                                {contact.tags.slice(0, 1).map((tag) => (
                                  <span
                                    key={tag}
                                    className="max-w-20 truncate rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {contact.conflicts &&
                              contact.conflicts.length > 0 && (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20 text-[10px] py-0 px-1 font-medium flex items-center gap-0.5"
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  Conflict
                                </Badge>
                              )}
                          </div>
                        </EditableContactCell>
                        <EditableContactCell
                          contact={contact}
                          field="company"
                          editor={inlineEditor}
                          onEdit={openInlineEditor}
                          onCancel={() => setInlineEditor(null)}
                          onChange={(value) =>
                            setInlineEditor((current) =>
                              current ? { ...current, value } : null,
                            )
                          }
                          onSave={saveInlineEditor}
                          saving={updateContactMutation.isPending}
                          ownerOptions={ownerOptions}
                          order={columnPosition("organization")}
                          className="flex min-w-0 items-center gap-2 px-4 py-3 text-sm text-muted-foreground"
                        >
                          <Building2 className="h-4 w-4 shrink-0 text-indigo-500" />
                          <span className="truncate" title={contact.company}>
                            {contact.company || "—"}
                          </span>
                        </EditableContactCell>
                        <EditableContactCell
                          contact={contact}
                          field="email"
                          editor={inlineEditor}
                          onEdit={openInlineEditor}
                          onCancel={() => setInlineEditor(null)}
                          onChange={(value) =>
                            setInlineEditor((current) =>
                              current ? { ...current, value } : null,
                            )
                          }
                          onSave={saveInlineEditor}
                          saving={updateContactMutation.isPending}
                          ownerOptions={ownerOptions}
                          order={columnPosition("email")}
                          className="flex min-w-0 items-center gap-2 px-4 py-3 text-sm text-muted-foreground"
                        >
                          <Mail className="h-4 w-4 shrink-0 text-rose-500" />
                          <span className="truncate" title={contact.email}>
                            {contact.email || "—"}
                          </span>
                        </EditableContactCell>
                        <EditableContactCell
                          contact={contact}
                          field="phone"
                          editor={inlineEditor}
                          onEdit={openInlineEditor}
                          onCancel={() => setInlineEditor(null)}
                          onChange={(value) =>
                            setInlineEditor((current) =>
                              current ? { ...current, value } : null,
                            )
                          }
                          onSave={saveInlineEditor}
                          saving={updateContactMutation.isPending}
                          ownerOptions={ownerOptions}
                          order={columnPosition("phone")}
                          className="flex min-w-0 items-center gap-2 px-4 py-3 text-sm text-muted-foreground"
                        >
                          <Phone className="h-4 w-4 shrink-0 text-sky-600" />
                          <span className="truncate">
                            {contact.phone || "—"}
                          </span>
                        </EditableContactCell>
                        <div
                          className="flex items-center border-r border-border/40 px-4 py-3 text-sm"
                          style={{ order: columnPosition("openDeals") }}
                        >
                          <span className="inline-flex min-w-12 items-center justify-center gap-1.5 rounded-full bg-sky-50 px-2 py-1 font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                            <CircleDotDashed className="h-3.5 w-3.5" />
                            {dealCounts.open}
                          </span>
                        </div>
                        <div
                          className="flex items-center border-r border-border/40 px-4 py-3 text-sm"
                          style={{ order: columnPosition("wonDeals") }}
                        >
                          <span className="inline-flex min-w-12 items-center justify-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <CircleCheckBig className="h-3.5 w-3.5" />
                            {dealCounts.closed}
                          </span>
                        </div>
                        <div
                          className="flex min-w-0 items-center border-r border-border/40 px-4 py-3 text-sm text-muted-foreground"
                          style={{ order: columnPosition("nextActivity") }}
                        >
                          <span
                            className={`inline-flex max-w-full items-center gap-2 rounded-full px-2.5 py-1 ${contact.nextFollowUpAt ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "bg-muted/70"}`}
                          >
                            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                              {contact.nextFollowUpAt
                                ? formatDate(contact.nextFollowUpAt)
                                : "Not scheduled"}
                            </span>
                          </span>
                        </div>
                        <EditableContactCell
                          contact={contact}
                          field="ownerId"
                          editor={inlineEditor}
                          onEdit={openInlineEditor}
                          onCancel={() => setInlineEditor(null)}
                          onChange={(value) =>
                            setInlineEditor((current) =>
                              current ? { ...current, value } : null,
                            )
                          }
                          onSave={saveInlineEditor}
                          saving={updateContactMutation.isPending}
                          ownerOptions={ownerOptions}
                          order={columnPosition("owner")}
                          className="min-w-0 px-4 py-3 text-sm text-muted-foreground"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                              {contact.owner?.name
                                ? contact.owner.name
                                    .split(" ")
                                    .map((part) => part[0])
                                    .join("")
                                    .slice(0, 2)
                                    .toUpperCase()
                                : "—"}
                            </span>
                            <span className="truncate font-medium text-foreground">
                              {contact.owner?.name || "Unassigned"}
                            </span>
                          </span>
                        </EditableContactCell>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {!isLoadingContacts && displayedContacts.length === 0 && (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-medium">No contacts found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "No contacts match the current search and filters."
                  : "Create the first contact to begin building your CRM."}
              </p>
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="mt-4 cursor-pointer"
                >
                  Clear filters
                </Button>
              )}
            </div>
          )}

          {totalPages > 1 && (
            <div className="pt-4 border-t border-border">
              <Pagination>
                <PaginationContent>
                  <PaginationItem className="cursor-pointer">
                    <PaginationPrevious
                      onClick={(e) => {
                        e.preventDefault();
                        goPrev();
                      }}
                      className={
                        currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : ""
                      }
                    />
                  </PaginationItem>
                  {pageNumbers.map((page, idx) => (
                    <PaginationItem key={idx} className="cursor-pointer">
                      {page === "..." ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          isActive={page === currentPage}
                          onClick={(e) => {
                            e.preventDefault();
                            goToPage(page as number);
                          }}
                        >
                          {page}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}
                  <PaginationItem className="cursor-pointer">
                    <PaginationNext
                      onClick={(e) => {
                        e.preventDefault();
                        goToNext();
                      }}
                      className={
                        currentPage === totalPages
                          ? "pointer-events-none opacity-50"
                          : ""
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      <DeleteConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleBulkDelete}
        title="Delete Contacts"
        itemName={`${selectedContacts.length} selected contact(s)`}
        isDeleting={deleteContactsMutation.isPending}
      />

      <Dialog open={isBulkTagDialogOpen} onOpenChange={setIsBulkTagDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              Add Tags in Bulk
            </DialogTitle>
            <DialogDescription>
              Apply tags to the {selectedContacts.length} selected contacts.
              Enter tags separated by commas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-tags-input">Tags</Label>
              <Input
                id="bulk-tags-input"
                placeholder="e.g. VIP, Enterprise, At Risk"
                value={bulkTagsInput}
                onChange={(e) => setBulkTagsInput(e.target.value)}
                autoFocus
                className="cursor-text"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsBulkTagDialogOpen(false);
                setBulkTagsInput("");
              }}
              disabled={bulkAddTagsMutation.isPending}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkAddTags}
              disabled={bulkAddTagsMutation.isPending || !bulkTagsInput.trim()}
              className="cursor-pointer bg-primary hover:bg-primary/95 text-primary-foreground border-0"
            >
              {bulkAddTagsMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add Tags
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isConflictSheetOpen} onOpenChange={setIsConflictSheetOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Pending Profile Conflicts
            </DialogTitle>
            <DialogDescription>
              {focusedConflictContactId
                ? "Review and resolve conflicting profile details captured for this contact."
                : "Multiple conflicting profile details were captured during user conversations. Resolve them below to maintain profile integrity."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {(focusedConflictContactId
              ? conflicts.filter(
                  (c) => c.contactId === focusedConflictContactId,
                )
              : conflicts
            ).map((conflict) => (
              <div
                key={conflict.id}
                className="border border-border rounded-lg p-4 space-y-3 bg-muted/20"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-sm">
                      {conflict.contactName}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {conflict.contactEmail || "No email"}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize text-xs">
                    {conflict.field} Mismatch
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm bg-background border border-border rounded-md p-3">
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">
                      Current Value
                    </span>
                    <span className="font-medium text-foreground block truncate">
                      {conflict.currentValue || (
                        <em className="text-muted-foreground text-xs">
                          Not set
                        </em>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-amber-600 dark:text-amber-500 block mb-1">
                      Proposed Value
                    </span>
                    <span className="font-medium text-amber-600 dark:text-amber-500 block truncate">
                      {conflict.proposedValue}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center gap-3 pt-1">
                  <button
                    onClick={() => {
                      setIsConflictSheetOpen(false);
                      navigate(
                        `/dashboard/conversations/inbox/chat/${conflict.conversationId}`,
                      );
                    }}
                    className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
                  >
                    View Chat Session
                  </button>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleResolveConflict(conflict.id, "dismiss")
                      }
                      className="cursor-pointer text-xs"
                    >
                      Keep Current
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        handleResolveConflict(conflict.id, "apply")
                      }
                      className="cursor-pointer text-xs bg-amber-500 hover:bg-amber-600 text-white border-0"
                    >
                      Apply Proposed
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {conflicts.length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                All conflicts have been resolved!
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
