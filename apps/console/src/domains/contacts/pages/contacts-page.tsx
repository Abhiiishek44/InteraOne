import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ContactDetailsCard } from "../components/contact-details-card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
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
  Clock,
  MessagesSquare,
  AlertTriangle,
  Loader2,
  Tag,
} from "lucide-react";
import { ContactDialog } from "@/domains/contacts/components/contact-form";
import {
  usePendingConflicts,
  useResolveConflict,
  useDeleteContacts,
  useBulkAddTags,
  useCreateContact,
  useContactsPage,
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
import { SavedViewControls } from "@/domains/crm/components/saved-view-controls";
import type { SavedViewState } from "@/domains/crm/types/saved-view";

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

const formatRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = diff / (1000 * 60 * 60);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
};

const isRecentlyActive = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  return diff < 30 * 60 * 1000;
};

export function ContactsPage() {
  const navigate = useNavigate();
  const [isConflictSheetOpen, setIsConflictSheetOpen] = useState(false);
  const [focusedConflictContactId, setFocusedConflictContactId] = useState<
    string | null
  >(null);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [searchValue, setSearchValue] = useState("");
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [conversationFilter, setConversationFilter] = useState<string>("all");
  const [lifecycleFilter, setLifecycleFilter] = useState<string>("all");
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>("all");
  const [sortValue, setSortValue] = useState("recent");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkTagDialogOpen, setIsBulkTagDialogOpen] = useState(false);
  const [bulkTagsInput, setBulkTagsInput] = useState("");

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
    tags: tagFilters,
    activityRange: activityFilter,
    conversationRange: conversationFilter,
    sort: sortValue,
  });
  const rawContacts = contactsPage?.contacts || [];
  const { data: conflicts = [] } = usePendingConflicts();

  const resolveConflictMutation = useResolveConflict();
  const deleteContactsMutation = useDeleteContacts();
  const bulkAddTagsMutation = useBulkAddTags();
  const createContactMutation = useCreateContact();

  const loadError = loadErrorData ? loadErrorData.message : "";

  const contacts = useMemo(
    () => rawContacts.map(toContactViewModel),
    [rawContacts],
  );

  const filteredContacts = contacts;
  const fallbackContactId = contacts[0]?.id || "";
  const effectiveSelectedContactId = contacts.some(
    (contact) => contact.id === selectedContactId,
  )
    ? selectedContactId
    : fallbackContactId;
  const selectedContact = contacts.find(
    (contact) => contact.id === effectiveSelectedContactId,
  );
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
      if (createdId) setSelectedContactId(createdId);
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
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    searchValue.trim() ||
    tagFilters.length > 0 ||
    activityFilter !== "all" ||
    conversationFilter !== "all" ||
    lifecycleFilter !== "all" ||
    leadStatusFilter !== "all",
  );

  const savedViewState = useMemo(
    () => ({
      search: searchValue,
      tags: tagFilters,
      activity: activityFilter,
      conversations: conversationFilter,
      lifecycle: lifecycleFilter,
      leadStatus: leadStatusFilter,
      sort: sortValue,
    }),
    [
      activityFilter,
      conversationFilter,
      leadStatusFilter,
      lifecycleFilter,
      searchValue,
      sortValue,
      tagFilters,
    ],
  );

  const applySavedView = (state: SavedViewState) => {
    setSearchValue(typeof state.search === "string" ? state.search : "");
    setTagFilters(
      Array.isArray(state.tags)
        ? state.tags.filter((tag): tag is string => typeof tag === "string")
        : [],
    );
    setActivityFilter(
      typeof state.activity === "string" ? state.activity : "all",
    );
    setConversationFilter(
      typeof state.conversations === "string" ? state.conversations : "all",
    );
    setLifecycleFilter(
      typeof state.lifecycle === "string" ? state.lifecycle : "all",
    );
    setLeadStatusFilter(
      typeof state.leadStatus === "string" ? state.leadStatus : "all",
    );
    setSortValue(typeof state.sort === "string" ? state.sort : "recent");
    setCurrentPage(1);
  };

  const handleBulkDelete = async () => {
    if (selectedContacts.length === 0) return;
    try {
      await deleteContactsMutation.mutateAsync(selectedContacts);
      setSelectedContacts([]);
      setSelectedContactId("");
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
      "Company",
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
    <div className="space-y-6">
      <div
        className="flex flex-wrap items-center justify-between gap-4"
        data-tour-id="page-contacts-heading"
      >
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">
            Manage customer profiles, tags, and conversation context in one
            workspace.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {isLoadingContacts
              ? "Syncing contacts from database..."
              : loadError
                ? `Showing fallback sample data: ${loadError}`
                : "Live contact data is synced from your organization database."}
          </p>
        </div>
        <div
          className="flex flex-wrap items-center gap-2"
          data-tour-id="page-contacts-primary-action"
        >
          <SavedViewControls
            entityType="contacts"
            state={savedViewState}
            onApply={applySavedView}
          />
          <ContactDialog
            mode="create"
            onSubmit={handleAddContact}
            triggerType="custom"
            customTrigger={
              <Button className="cursor-pointer">
                <Plus className="h-4 w-4 mr-2" />
                Add contact
              </Button>
            }
          />
        </div>
      </div>

      <div className="space-y-6">
        <Card data-tour-id="page-contacts-filters">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-3">
              <Label>Lifecycle stage</Label>
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

            <div className="space-y-3">
              <Label>Lead status</Label>
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

            <div className="space-y-3">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {TAG_OPTIONS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() =>
                      setTagFilters((prev) =>
                        prev.includes(tag)
                          ? prev.filter((item) => item !== tag)
                          : [...prev, tag],
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-xs transition-colors cursor-pointer ${
                      tagFilters.includes(tag)
                        ? "bg-primary text-primary-foreground border-transparent"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Last activity</Label>
              <Select value={activityFilter} onValueChange={setActivityFilter}>
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

            <div className="space-y-3">
              <Label>Conversations</Label>
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

            <div className="flex items-end">
              <Button
                variant="outline"
                className="w-full cursor-pointer"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
              >
                Clear filters
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <Card className="min-w-0" data-tour-id="page-contacts-list">
            <CardHeader className="border-b space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-base font-semibold">
                  <Users className="h-4 w-4" />
                  {totalItems} contacts
                </div>
                <Select value={sortValue} onValueChange={setSortValue}>
                  <SelectTrigger className="w-52 cursor-pointer">
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
              <div className="relative" data-tour-id="page-contacts-search">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, phone, or company"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  className="pl-10 cursor-text"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
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

              <div className="flex flex-col gap-1">
                {paginatedContacts.map((contact) => {
                  const isActive = contact.id === effectiveSelectedContactId;
                  const isSelected = selectedContacts.includes(contact.id);
                  return (
                    <div
                      key={contact.id}
                      className={`relative w-full rounded-lg border-l-4 py-3.5 px-4 text-left transition-all select-none ${
                        isActive
                          ? "bg-primary/[0.04] border-l-primary shadow-xs"
                          : isSelected
                            ? "bg-primary/[0.015] border-l-transparent"
                            : "hover:bg-muted/30 border-l-transparent"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${contact.name} for bulk actions`}
                            checked={selectedContacts.includes(contact.id)}
                            onChange={() => toggleBulkSelect(contact.id)}
                            className="accent-primary cursor-pointer"
                          />
                          <div className="relative">
                            <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                              {contact.name
                                .split(" ")
                                .map((part) => part[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                                contact.isOnline
                                  ? "bg-emerald-500"
                                  : isRecentlyActive(contact.lastActivity)
                                    ? "bg-amber-400"
                                    : "bg-muted"
                              }`}
                              title={
                                contact.isOnline ? "Online" : "Recently active"
                              }
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedContactId(contact.id)}
                          className="grid min-w-0 flex-1 cursor-pointer grid-cols-1 gap-y-3 text-left md:grid-cols-[minmax(200px,240px)_minmax(220px,250px)_minmax(160px,1fr)] md:gap-x-4"
                        >
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <h3 className="truncate font-semibold text-foreground">
                                {contact.name}
                              </h3>
                              <Badge
                                variant="outline"
                                className="text-[10px] capitalize"
                              >
                                {contact.lifecycleStage}
                              </Badge>
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
                            <p className="truncate text-sm text-muted-foreground">
                              {contact.email ||
                                contact.phone ||
                                "No contact info"}
                            </p>
                          </div>
                          <div className="min-w-0 text-sm text-muted-foreground">
                            <div className="truncate font-medium text-foreground">
                              {contact.company || "Independent"}
                            </div>
                            <div className="mt-0.5 text-xs capitalize">
                              {contact.owner?.name || "Unassigned"} ·{" "}
                              {contact.leadStatus.replace("_", " ")}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {contact.tags.slice(0, 3).map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {tag}
                                </Badge>
                              ))}
                              {contact.tags.length > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  +{contact.tags.length - 3}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="min-w-0 text-sm text-muted-foreground md:w-[200px] md:justify-self-end">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span>
                                {formatRelative(contact.lastActivity)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <MessagesSquare className="h-4 w-4" />
                              <span>
                                {contact.conversationCount} conversations
                              </span>
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  );
                })}
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

          <Card className="h-fit xl:sticky xl:top-6">
            <CardHeader className="border-b">
              <CardTitle className="text-base">Contact details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {!selectedContact ? (
                <div className="text-sm text-muted-foreground">
                  Select a contact to see details.
                </div>
              ) : (
                <ContactDetailsCard
                  contact={selectedContact}
                  onResolveConflictsClick={() => {
                    setFocusedConflictContactId(selectedContact.id);
                    setIsConflictSheetOpen(true);
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

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
                ? `Review and resolve conflicting profile details captured for ${selectedContact?.name || "this contact"}.`
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
