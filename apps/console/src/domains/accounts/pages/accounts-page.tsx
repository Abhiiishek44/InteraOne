import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import {
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  CircleDotDashed,
  Filter,
  ExternalLink,
  GripVertical,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  TriangleAlert,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAccounts,
  useCreateAccount,
  useUpdateAccount,
} from "../hooks/use-accounts";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Loader } from "@/shared/ui/loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useContactOwners } from "@/domains/contacts/hooks/use-contacts";
import { useAuth } from "@/domains/auth/hooks/useAuth";
import { LabelPicker } from "@/shared/components/label-editor";

const DEFAULT_ORGANIZATION_LABELS = [
  "Customer",
  "VIP",
  "Warm lead",
  "Hot lead",
  "Cold lead",
];

const emptyForm = {
  name: "",
  labels: [] as string[],
  ownerId: "",
  address: "",
};

type OrganizationColumnId =
  | "name"
  | "address"
  | "owner"
  | "people"
  | "closedDeals"
  | "openDeals"
  | "nextActivity";

const ORGANIZATION_COLUMNS: Record<
  OrganizationColumnId,
  { label: string; width: string }
> = {
  name: { label: "Name", width: "minmax(280px,1.35fr)" },
  address: { label: "Address", width: "minmax(260px,1.2fr)" },
  owner: { label: "Owner", width: "minmax(200px,.9fr)" },
  people: { label: "People", width: "140px" },
  closedDeals: { label: "Closed deals", width: "155px" },
  openDeals: { label: "Open deals", width: "155px" },
  nextActivity: { label: "Next activity", width: "minmax(210px,1fr)" },
};
const DEFAULT_ORGANIZATION_COLUMN_ORDER = Object.keys(
  ORGANIZATION_COLUMNS,
) as OrganizationColumnId[];

const organizationColumnIcon = (id: OrganizationColumnId) => {
  if (id === "name") return Building2;
  if (id === "address") return MapPin;
  if (id === "owner") return UserRound;
  if (id === "people") return Users;
  if (id === "closedDeals") return CircleCheckBig;
  if (id === "openDeals") return CircleDotDashed;
  return CalendarClock;
};

export function AccountsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [duplicateSearch, setDuplicateSearch] = useState("");
  const [showDuplicateMatches, setShowDuplicateMatches] = useState(true);
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>(
    [],
  );
  const [bulkTagsOpen, setBulkTagsOpen] = useState(false);
  const [bulkTagsInput, setBulkTagsInput] = useState("");
  const [draggedColumn, setDraggedColumn] =
    useState<OrganizationColumnId | null>(null);
  const [columnOrder, setColumnOrder] = useState<OrganizationColumnId[]>(() => {
    try {
      const saved = JSON.parse(
        window.localStorage.getItem("organizations-column-order") || "[]",
      ) as OrganizationColumnId[];
      return saved.length === DEFAULT_ORGANIZATION_COLUMN_ORDER.length &&
        DEFAULT_ORGANIZATION_COLUMN_ORDER.every((id) => saved.includes(id))
        ? saved
        : DEFAULT_ORGANIZATION_COLUMN_ORDER;
    } catch {
      return DEFAULT_ORGANIZATION_COLUMN_ORDER;
    }
  });
  const { data, isLoading } = useAccounts(search, 100);
  const { data: duplicateData } = useAccounts(duplicateSearch, 10, {
    enabled: open && duplicateSearch.length >= 2,
  });
  const { data: ownerOptions = [] } = useContactOwners();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const organizations = useMemo(() => data?.accounts || [], [data?.accounts]);
  const duplicateMatches = useMemo(() => {
    const normalizedName = form.name.trim().toLocaleLowerCase();
    if (normalizedName.length < 2) return [];
    return (duplicateData?.accounts || []).filter((organization) =>
      organization.name.toLocaleLowerCase().includes(normalizedName),
    );
  }, [duplicateData?.accounts, form.name]);
  const labelOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...DEFAULT_ORGANIZATION_LABELS,
          ...organizations.flatMap((organization) => [
            ...(organization.labels || []),
            ...(organization.tags || []),
          ]),
          ...form.labels,
        ]),
      ),
    [form.labels, organizations],
  );

  useEffect(() => {
    window.localStorage.setItem(
      "organizations-column-order",
      JSON.stringify(columnOrder),
    );
  }, [columnOrder]);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDuplicateSearch(form.name.trim()),
      250,
    );
    return () => window.clearTimeout(timeout);
  }, [form.name]);

  const openCreateOrganization = () => {
    setForm({ ...emptyForm, ownerId: user?.id || "" });
    setDuplicateSearch("");
    setShowDuplicateMatches(true);
    setOpen(true);
  };

  const moveColumn = (source: OrganizationColumnId, targetIndex: number) => {
    setColumnOrder((current) => {
      const sourceIndex = current.indexOf(source);
      if (sourceIndex < 0) return current;
      const next = [...current];
      next.splice(sourceIndex, 1);
      next.splice(Math.max(0, Math.min(targetIndex, next.length)), 0, source);
      return next;
    });
  };
  const columnGridTemplate = columnOrder
    .map((id) => ORGANIZATION_COLUMNS[id].width)
    .join(" ");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const created = await createAccount.mutateAsync({
        name: form.name.trim(),
        labels: form.labels,
        ownerId: form.ownerId || null,
        address: form.address.trim(),
      });
      toast.success("Organization created");
      setOpen(false);
      setForm(emptyForm);
      navigate(`/dashboard/crm/organizations/${created._id}`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create organization",
      );
    }
  };

  const toggleSelectPage = () => {
    const pageIds = organizations.map((organization) => organization.id);
    const allSelected = pageIds.every((id) =>
      selectedOrganizations.includes(id),
    );
    setSelectedOrganizations((current) =>
      allSelected
        ? current.filter((id) => !pageIds.includes(id))
        : [...new Set([...current, ...pageIds])],
    );
  };

  const exportSelectedOrganizations = () => {
    const selected = organizations.filter((organization) =>
      selectedOrganizations.includes(organization.id),
    );
    if (!selected.length) return;
    const rows = [
      [
        "Name",
        "Address",
        "Website",
        "Industry",
        "Owner",
        "People",
        "Open deals",
        "Closed deals",
        "Tags",
      ],
      ...selected.map((organization) => [
        organization.name,
        organization.address || "",
        organization.website || "",
        organization.industry || "",
        organization.owner?.name || "",
        String(organization.contactCount),
        String(organization.openDeals),
        String(organization.closedDeals),
        (organization.tags || []).join("; "),
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((value) => `"${value.replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "selected-organizations.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const addTagsToSelectedOrganizations = async () => {
    const tagsToAdd = bulkTagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (!tagsToAdd.length) return;
    try {
      await Promise.all(
        organizations
          .filter((organization) =>
            selectedOrganizations.includes(organization.id),
          )
          .map((organization) =>
            updateAccount.mutateAsync({
              id: organization.id,
              payload: {
                tags: [
                  ...new Set([...(organization.tags || []), ...tagsToAdd]),
                ],
              },
            }),
          ),
      );
      setBulkTagsInput("");
      setBulkTagsOpen(false);
      toast.success("Tags added to selected organizations");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add tags",
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-sm text-muted-foreground">
            Manage organizations, people, deals, and upcoming activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {data?.total || 0} organizations
          </span>
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" /> Filter
          </Button>
          <Button onClick={openCreateOrganization}>
            <Plus className="mr-2 h-4 w-4" /> Organization
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search organizations…"
          className="pl-9"
        />
      </div>

      <div className="space-y-3">
        {selectedOrganizations.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border p-3">
            <span className="text-sm text-muted-foreground">
              {selectedOrganizations.length} organization
              {selectedOrganizations.length === 1 ? "" : "s"} selected
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkTagsOpen(true)}
              >
                Add tags
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportSelectedOrganizations}
              >
                Export
              </Button>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={
                organizations.length > 0 &&
                organizations.every((organization) =>
                  selectedOrganizations.includes(organization.id),
                )
              }
              onChange={toggleSelectPage}
              className="cursor-pointer accent-primary"
            />
            Select page
          </label>
          <span>
            Showing {organizations.length} of {data?.total || 0} results
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/80 bg-background shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader size="lg" />
          </div>
        ) : organizations.length ? (
          <div className="overflow-x-auto">
            <div className="min-w-[1500px]">
              <div
                className="grid items-stretch border-b-2 border-primary/20 bg-slate-100/90 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
                style={{
                  gridTemplateColumns: `48px ${columnGridTemplate} 48px`,
                }}
              >
                <span className="flex items-center justify-center border-r border-border/60">
                  <input
                    type="checkbox"
                    aria-label="Select all organizations"
                    checked={
                      organizations.length > 0 &&
                      organizations.every((organization) =>
                        selectedOrganizations.includes(organization.id),
                      )
                    }
                    onChange={(event) =>
                      setSelectedOrganizations(
                        event.target.checked
                          ? organizations.map((organization) => organization.id)
                          : [],
                      )
                    }
                    className="cursor-pointer accent-primary"
                  />
                </span>
                {columnOrder.map((columnId, index) => {
                  const HeaderIcon = organizationColumnIcon(columnId);
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
                      className={`group flex cursor-grab items-center gap-1 border-r border-border/60 px-2 py-3 active:cursor-grabbing ${draggedColumn === columnId ? "bg-primary/10 opacity-60" : "hover:bg-primary/[0.05]"}`}
                    >
                      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                      <HeaderIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate">
                        {ORGANIZATION_COLUMNS[columnId].label}
                      </span>
                      <span className="hidden shrink-0 group-hover:flex group-focus-within:flex">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveColumn(columnId, index - 1)}
                          className="rounded p-0.5 hover:bg-background disabled:opacity-20"
                          aria-label={`Move ${ORGANIZATION_COLUMNS[columnId].label} left`}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === columnOrder.length - 1}
                          onClick={() => moveColumn(columnId, index + 1)}
                          className="rounded p-0.5 hover:bg-background disabled:opacity-20"
                          aria-label={`Move ${ORGANIZATION_COLUMNS[columnId].label} right`}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                  );
                })}
                <span />
              </div>

              <div className="flex flex-col">
                {organizations.map((organization) => {
                  const selected = selectedOrganizations.includes(
                    organization.id,
                  );
                  return (
                    <div
                      key={organization.id}
                      className={`grid min-h-[52px] border-b border-border/70 last:border-b-0 ${selected ? "bg-primary/[0.07] shadow-[inset_3px_0_0_hsl(var(--primary))]" : "hover:bg-muted/30"}`}
                      style={{
                        gridTemplateColumns: `48px ${columnGridTemplate} 48px`,
                      }}
                    >
                      <div className="flex items-center justify-center border-r border-border/40">
                        <input
                          type="checkbox"
                          aria-label={`Select ${organization.name}`}
                          checked={selected}
                          onChange={() =>
                            setSelectedOrganizations((current) =>
                              selected
                                ? current.filter((id) => id !== organization.id)
                                : [...current, organization.id],
                            )
                          }
                          className="cursor-pointer accent-primary"
                        />
                      </div>
                      {columnOrder.map((columnId) => (
                        <div
                          key={columnId}
                          className="flex min-w-0 items-center border-r border-border/40 px-4 py-2"
                        >
                          {columnId === "name" ? (
                            <Link
                              to={`/dashboard/crm/organizations/${organization.id}`}
                              className="min-w-0 font-medium text-primary hover:underline"
                            >
                              <span className="block truncate font-semibold">
                                {organization.name}
                              </span>
                            </Link>
                          ) : columnId === "address" ? (
                            <span className="truncate text-muted-foreground">
                              {organization.address || "—"}
                            </span>
                          ) : columnId === "owner" ? (
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                                {organization.owner?.name
                                  ?.split(" ")
                                  .map((part) => part[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase() || "—"}
                              </span>
                              <span className="truncate">
                                {organization.owner?.name || "Unassigned"}
                              </span>
                            </span>
                          ) : columnId === "people" ? (
                            <span className="font-semibold">
                              {organization.contactCount}
                            </span>
                          ) : columnId === "closedDeals" ? (
                            <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                              {organization.closedDeals}
                            </span>
                          ) : columnId === "openDeals" ? (
                            <span className="font-semibold text-blue-700 dark:text-blue-300">
                              {organization.openDeals}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {organization.nextActivityAt
                                ? new Date(
                                    organization.nextActivityAt,
                                  ).toLocaleDateString()
                                : "—"}
                            </span>
                          )}
                        </div>
                      ))}
                      <div className="flex items-center justify-center">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`More actions for ${organization.name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-16 text-center text-muted-foreground">
            <Building2 className="mx-auto mb-3 h-8 w-8" />
            <p>No organizations found.</p>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add organization</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="organization-name">Name</Label>
              <div className="relative">
                <Input
                  id="organization-name"
                  required
                  autoFocus
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  className={duplicateMatches.length ? "pr-9" : undefined}
                />
                {duplicateMatches.length > 0 && (
                  <TriangleAlert className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Labels</Label>
              <LabelPicker
                value={form.labels.join(", ")}
                options={labelOptions}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    labels: value
                      .split(",")
                      .map((label) => label.trim())
                      .filter(Boolean),
                  }))
                }
                disabled={createAccount.isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label>Owner</Label>
              <Select
                value={form.ownerId || "unassigned"}
                onValueChange={(ownerId) =>
                  setForm({
                    ...form,
                    ownerId: ownerId === "unassigned" ? "" : ownerId,
                  })
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
                      {owner.id === user?.id ? " (You)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="organization-address">Address</Label>
              <Input
                id="organization-address"
                value={form.address}
                onChange={(event) =>
                  setForm({ ...form, address: event.target.value })
                }
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createAccount.isPending || !form.name.trim()}
              >
                {createAccount.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
          {duplicateMatches.length > 0 && (
            <aside className="absolute left-[calc(100%+12px)] top-16 hidden w-72 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl sm:block">
              <div className="border-b px-4 py-3 font-semibold">
                Possible duplicate
              </div>
              <div className="divide-y">
                {showDuplicateMatches &&
                  duplicateMatches.slice(0, 5).map((organization) => (
                    <button
                      key={organization.id}
                      type="button"
                      onClick={() =>
                        navigate(
                          `/dashboard/crm/organizations/${organization.id}`,
                        )
                      }
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-muted"
                    >
                      <span className="truncate font-medium">
                        {organization.name}
                      </span>
                      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
              </div>
              <label className="flex cursor-pointer items-center gap-2 border-t px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={showDuplicateMatches}
                  onChange={(event) =>
                    setShowDuplicateMatches(event.target.checked)
                  }
                  className="accent-primary"
                />
                Show matches as I type
              </label>
            </aside>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={bulkTagsOpen} onOpenChange={setBulkTagsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add tags</DialogTitle>
            <DialogDescription>
              Apply comma-separated tags to {selectedOrganizations.length}{" "}
              selected organization(s).
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={bulkTagsInput}
            onChange={(event) => setBulkTagsInput(event.target.value)}
            placeholder="Customer, VIP"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkTagsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void addTagsToSelectedOrganizations()}
              disabled={!bulkTagsInput.trim() || updateAccount.isPending}
            >
              Add tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
