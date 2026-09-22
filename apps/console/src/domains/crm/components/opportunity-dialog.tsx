import { useEffect, useState, type FocusEvent, type FormEvent } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Loader2,
  Search,
} from "lucide-react";
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
import type {
  ContactListItem,
  ContactOwner,
} from "@/domains/contacts/types/types";
import { useContactsPage } from "@/domains/contacts/hooks/use-contacts";
import { useAccounts } from "@/domains/accounts/hooks/use-accounts";
import {
  useCreateOpportunity,
  useUpdateOpportunity,
} from "../hooks/use-opportunities";
import type {
  CreateOpportunityPayload,
  Opportunity,
  PipelineStage,
} from "../types/types";

interface OpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStage?: string;
  stages: PipelineStage[];
  owners: ContactOwner[];
  opportunity?: Opportunity;
}

const emptyForm: CreateOpportunityPayload = {
  contactId: "",
  primaryContactId: null,
  accountId: null,
  title: "",
  company: "",
  value: 0,
  currency: "USD",
  stage: "",
  ownerId: null,
  expectedCloseAt: null,
  nextAction: "",
};

export function OpportunityDialog({
  open,
  onOpenChange,
  initialStage,
  stages,
  owners,
  opportunity,
}: OpportunityDialogProps) {
  const isEditing = Boolean(opportunity);
  const createOpportunity = useCreateOpportunity();
  const updateOpportunity = useUpdateOpportunity();
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [debouncedContactSearch, setDebouncedContactSearch] = useState("");
  const [contactPage, setContactPage] = useState(1);
  const [selectedContact, setSelectedContact] =
    useState<ContactListItem | null>(null);
  const { data: accountsData } = useAccounts("", 100);
  const [form, setForm] = useState<CreateOpportunityPayload>(() => {
    const firstOpen = stages.find((stage) => stage.type === "open");
    return {
      ...emptyForm,
      stage: initialStage || firstOpen?.id || stages[0]?.id || "",
    };
  });

  const { data: contactResults, isFetching: contactsLoading } = useContactsPage(
    {
      search: debouncedContactSearch,
      page: contactPage,
      limit: 20,
      sort: "name",
    },
    { enabled: open && !isEditing && contactPickerOpen },
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedContactSearch(contactSearch.trim());
      setContactPage(1);
    }, 250);
    return () => clearTimeout(timeout);
  }, [contactSearch]);

  useEffect(() => {
    if (!open) return;
    const firstOpen = stages.find((stage) => stage.type === "open");
    const timeout = setTimeout(() => {
      setContactPickerOpen(false);
      setContactSearch("");
      setDebouncedContactSearch("");
      setContactPage(1);
      setSelectedContact(null);
      setForm(
        opportunity
          ? {
              contactId: opportunity.contact?.id || "",
              primaryContactId: opportunity.contact?.id || null,
              accountId: opportunity.account?.id || null,
              title: opportunity.title,
              company: opportunity.company || "",
              value: opportunity.value,
              currency: opportunity.currency,
              stage: opportunity.stage,
              ownerId: opportunity.owner?.id || null,
              expectedCloseAt:
                opportunity.expectedCloseAt?.slice(0, 10) || null,
              nextAction: opportunity.nextAction || "",
            }
          : {
              ...emptyForm,
              stage: initialStage || firstOpen?.id || stages[0]?.id || "",
            },
      );
    }, 0);
    return () => clearTimeout(timeout);
  }, [initialStage, open, opportunity, stages]);

  const selectContact = (contact: ContactListItem) => {
    setSelectedContact(contact);
    setContactPickerOpen(false);
    setForm((current) => ({
      ...current,
      contactId: contact.id,
      primaryContactId: contact.id,
      accountId: contact.account?.id || current.accountId,
      company: contact.company || current.company,
      title: current.title || `${contact.name} opportunity`,
      ownerId: contact.owner?.id || current.ownerId,
    }));
  };

  const closeContactPickerOnBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setContactPickerOpen(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const expectedCloseAt = form.expectedCloseAt
        ? new Date(form.expectedCloseAt).toISOString()
        : null;
      if (opportunity) {
        await updateOpportunity.mutateAsync({
          id: opportunity.id,
          title: form.title,
          company: form.company,
          accountId: form.accountId,
          primaryContactId: form.primaryContactId || form.contactId || null,
          value: form.value,
          currency: form.currency,
          ownerId: form.ownerId,
          expectedCloseAt,
          nextAction: form.nextAction,
        });
        toast.success("Opportunity updated");
      } else {
        await createOpportunity.mutateAsync({ ...form, expectedCloseAt });
        toast.success("Opportunity created");
      }
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${isEditing ? "update" : "create"} opportunity`,
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit opportunity" : "Create opportunity"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the opportunity details and ownership."
              : "Connect a sales opportunity to a company, a primary contact, or both."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="opportunity-company">Company</Label>
              <select
                id="opportunity-company"
                value={form.accountId || ""}
                onChange={(event) => {
                  const accountId = event.target.value || null;
                  const account = accountsData?.accounts.find((item) => item.id === accountId);
                  setForm((current) => ({ ...current, accountId, company: account?.name || current.company }));
                }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">No company selected</option>
                {(accountsData?.accounts || []).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="opportunity-contact">Primary contact</Label>
              <div className="relative" onBlur={closeContactPickerOnBlur}>
                <Button
                  id="opportunity-contact"
                  type="button"
                  variant="outline"
                  aria-haspopup="listbox"
                  aria-expanded={contactPickerOpen}
                  className="h-9 w-full justify-between px-3 font-normal"
                  onClick={() => setContactPickerOpen((current) => !current)}
                >
                  <span
                    className={
                      form.contactId
                        ? "truncate"
                        : "truncate text-muted-foreground"
                    }
                  >
                    {selectedContact?.name ||
                      opportunity?.contact?.name ||
                      "Search and select a contact"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                </Button>
                {contactPickerOpen && (
                  <div className="absolute z-50 mt-1 w-full min-w-72 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
                    <div className="relative border-b p-2">
                      <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        autoFocus
                        value={contactSearch}
                        onChange={(event) =>
                          setContactSearch(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Escape")
                            setContactPickerOpen(false);
                        }}
                        placeholder="Search by name, email, phone…"
                        className="pl-9"
                        aria-label="Search contacts"
                      />
                    </div>
                    <div
                      role="listbox"
                      aria-label="Contacts"
                      className="max-h-60 overflow-y-auto p-1 [scrollbar-color:hsl(var(--muted-foreground)/0.35)_transparent] [scrollbar-width:thin]"
                    >
                      {contactsLoading && !contactResults ? (
                        <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading
                          contacts…
                        </div>
                      ) : contactResults?.contacts.length ? (
                        contactResults.contacts.map((contact) => (
                          <button
                            key={contact.id}
                            type="button"
                            role="option"
                            aria-selected={form.contactId === contact.id}
                            onClick={() => selectContact(contact)}
                            className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:outline-none"
                          >
                            <Check
                              className={`h-4 w-4 shrink-0 ${
                                form.contactId === contact.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              }`}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">
                                {contact.name}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {contact.email ||
                                  contact.phone ||
                                  contact.company ||
                                  "No contact details"}
                              </span>
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                          No contacts found.
                        </div>
                      )}
                    </div>
                    {contactResults && contactResults.total > 0 && (
                      <div className="flex items-center justify-between border-t px-2 py-1.5">
                        <span className="text-xs text-muted-foreground">
                          {contactResults.total} contact
                          {contactResults.total === 1 ? "" : "s"}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={contactPage <= 1 || contactsLoading}
                            onClick={() => setContactPage((page) => page - 1)}
                            aria-label="Previous contacts page"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="min-w-12 text-center text-xs">
                            {contactResults.page}/{contactResults.totalPages}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={
                              contactPage >= contactResults.totalPages ||
                              contactsLoading
                            }
                            onClick={() => setContactPage((page) => page + 1)}
                            aria-label="Next contacts page"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="opportunity-title">Opportunity name</Label>
              <Input
                id="opportunity-title"
                required
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Enterprise plan renewal"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="opportunity-value">Value</Label>
              <div className="flex gap-2">
                <select
                  value={form.currency}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      currency: event.target.value as Opportunity["currency"],
                    }))
                  }
                  className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option>USD</option>
                  <option>INR</option>
                  <option>EUR</option>
                  <option>GBP</option>
                </select>
                <Input
                  id="opportunity-value"
                  type="number"
                  min="0"
                  value={form.value}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      value: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="opportunity-stage">Stage</Label>
              <select
                id="opportunity-stage"
                value={form.stage}
                disabled={isEditing}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    stage: event.target.value,
                  }))
                }
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="opportunity-owner">Owner</Label>
              <select
                id="opportunity-owner"
                value={form.ownerId || ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    ownerId: event.target.value || null,
                  }))
                }
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">
                  {isEditing ? "Unassigned" : "Use contact owner"}
                </option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="opportunity-close-date">Expected close</Label>
              <Input
                id="opportunity-close-date"
                type="date"
                value={form.expectedCloseAt || ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    expectedCloseAt: event.target.value || null,
                  }))
                }
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="opportunity-next-action">Next action</Label>
            <Input
              id="opportunity-next-action"
              value={form.nextAction || ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  nextAction: event.target.value,
                }))
              }
              placeholder="Schedule product demo"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createOpportunity.isPending ||
                updateOpportunity.isPending ||
                (!form.contactId && !form.accountId) ||
                !form.title.trim() ||
                !form.stage
              }
            >
              {createOpportunity.isPending || updateOpportunity.isPending
                ? isEditing
                  ? "Saving…"
                  : "Creating…"
                : isEditing
                  ? "Save changes"
                  : "Create opportunity"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
