import { useMemo, useState, type FormEvent } from "react";
import { Building2, Mail, Phone, Plus, UserRound, X } from "lucide-react";
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
import { LabelPicker } from "@/shared/components/label-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  useAccounts,
  useCreateAccount,
} from "@/domains/accounts/hooks/use-accounts";
import {
  useContactOwners,
  useContacts,
  useCreateContact,
} from "@/domains/contacts/hooks/use-contacts";
import type { ContactMethod } from "@/domains/contacts/types/types";
import { useCreateCrmRecord } from "../hooks/use-crm-records";

const LEAD_LABELS = ["HOT LEAD", "WARM LEAD", "COLD LEAD"];
const SOURCE_CHANNELS = [
  "Web visitors",
  "Phone",
  "Email",
  "WhatsApp",
  "Referral",
  "API",
];

type LeadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
};

const emptyMethod = (): ContactMethod => ({ value: "", type: "work" });

export function LeadDialog({ open, onOpenChange, onCreated }: LeadDialogProps) {
  const { data: contacts = [] } = useContacts();
  const { data: accountsData } = useAccounts("", 200);
  const { data: owners = [] } = useContactOwners();
  const createContact = useCreateContact();
  const createAccount = useCreateAccount();
  const createLead = useCreateCrmRecord();
  const [personQuery, setPersonQuery] = useState("");
  const [organizationQuery, setOrganizationQuery] = useState("");
  const [contactId, setContactId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [personOpen, setPersonOpen] = useState(false);
  const [organizationOpen, setOrganizationOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [titleCustomized, setTitleCustomized] = useState(false);
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState<"USD" | "INR" | "EUR" | "GBP">(
    "INR",
  );
  const [labels, setLabels] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState("unassigned");
  const [expectedCloseAt, setExpectedCloseAt] = useState("");
  const [sourceChannel, setSourceChannel] = useState("manual");
  const [sourceChannelId, setSourceChannelId] = useState("");
  const [phones, setPhones] = useState<ContactMethod[]>([emptyMethod()]);
  const [emails, setEmails] = useState<ContactMethod[]>([emptyMethod()]);

  const matchingContacts = useMemo(() => {
    const query = personQuery.trim().toLowerCase();
    if (!query) return contacts.slice(0, 6);
    return contacts
      .filter((contact) =>
        [contact.name, contact.email, contact.phone, contact.company]
          .filter(Boolean)
          .some((entry) => entry!.toLowerCase().includes(query)),
      )
      .slice(0, 6);
  }, [contacts, personQuery]);

  const matchingAccounts = useMemo(() => {
    const query = organizationQuery.trim().toLowerCase();
    return (accountsData?.accounts || [])
      .filter((account) => !query || account.name.toLowerCase().includes(query))
      .slice(0, 6);
  }, [accountsData?.accounts, organizationQuery]);

  const reset = () => {
    setPersonQuery("");
    setOrganizationQuery("");
    setContactId(null);
    setAccountId(null);
    setTitle("");
    setTitleCustomized(false);
    setValue("");
    setCurrency("INR");
    setLabels([]);
    setOwnerId("unassigned");
    setExpectedCloseAt("");
    setSourceChannel("manual");
    setSourceChannelId("");
    setPhones([emptyMethod()]);
    setEmails([emptyMethod()]);
  };

  const chooseContact = (contact: (typeof contacts)[number]) => {
    setContactId(contact.id);
    setPersonQuery(contact.name);
    setPhones(
      contact.phones?.length
        ? contact.phones
        : [{ value: contact.phone || "", type: "work" }],
    );
    setEmails(
      contact.emails?.length
        ? contact.emails
        : [{ value: contact.email || "", type: "work" }],
    );
    if (contact.account) {
      setAccountId(contact.account.id);
      setOrganizationQuery(contact.account.name);
      if (!titleCustomized) setTitle(contact.account.name);
    } else if (contact.company) {
      setOrganizationQuery(contact.company);
      if (!titleCustomized) setTitle(contact.company);
    }
    setPersonOpen(false);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      let resolvedAccountId = accountId;
      if (!resolvedAccountId && organizationQuery.trim()) {
        const createdAccount = await createAccount.mutateAsync({
          name: organizationQuery.trim(),
        });
        resolvedAccountId = createdAccount._id;
      }

      let resolvedContactId = contactId;
      if (!resolvedContactId && personQuery.trim()) {
        const cleanPhones = phones.filter((item) => item.value.trim());
        const cleanEmails = emails.filter((item) => item.value.trim());
        const createdContact = await createContact.mutateAsync({
          name: personQuery.trim(),
          accountId: resolvedAccountId,
          company: organizationQuery.trim(),
          phone: cleanPhones[0]?.value || "",
          email: cleanEmails[0]?.value || "",
          phones: cleanPhones,
          emails: cleanEmails,
          ownerId: ownerId === "unassigned" ? null : ownerId,
          acquisitionSource: "manual",
          lifecycleStage: "new",
          leadStatus: "needs_review",
          tags: labels,
        });
        resolvedContactId = createdContact._id || createdContact.id || null;
      }

      if (!resolvedContactId && !resolvedAccountId) {
        toast.error("Select or create a contact person or organization");
        return;
      }

      const created = await createLead.mutateAsync({
        recordType: "lead",
        contactId: resolvedContactId,
        primaryContactId: resolvedContactId,
        accountId: resolvedAccountId,
        company: organizationQuery.trim(),
        title: title.trim() || personQuery.trim() || organizationQuery.trim(),
        value: Number(value) || 0,
        currency,
        labels,
        ownerId: ownerId === "unassigned" ? null : ownerId,
        expectedCloseAt: expectedCloseAt || null,
        sourceOrigin: "manual",
        sourceChannel: sourceChannel === "manual" ? "" : sourceChannel,
        sourceChannelId: sourceChannelId.trim(),
      });
      toast.success("Lead created");
      onOpenChange(false);
      reset();
      onCreated?.(created._id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create lead",
      );
    }
  };

  const pending =
    createLead.isPending || createContact.isPending || createAccount.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>Add lead</DialogTitle>
          <DialogDescription>
            Link an existing person and organization, or create them while
            adding the lead.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4 border-b p-6 lg:border-b-0 lg:border-r">
              <SearchField
                label="Contact person"
                icon={UserRound}
                value={personQuery}
                onChange={(nextValue) => {
                  setPersonQuery(nextValue);
                  setContactId(null);
                  setPersonOpen(true);
                }}
                onFocus={() => setPersonOpen(true)}
              >
                {personOpen && personQuery.trim() && (
                  <SearchResults>
                    {matchingContacts.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => chooseContact(contact)}
                        className="block w-full px-4 py-3 text-left hover:bg-muted"
                      >
                        <span className="block text-sm font-medium">
                          {contact.name}
                          {contact.company ? ` (${contact.company})` : ""}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {contact.email || contact.phone || "Existing contact"}
                        </span>
                      </button>
                    ))}
                    {!matchingContacts.some(
                      (contact) =>
                        contact.name.toLowerCase() ===
                        personQuery.trim().toLowerCase(),
                    ) && (
                      <button
                        type="button"
                        onClick={() => setPersonOpen(false)}
                        className="flex w-full items-center gap-2 border-t px-4 py-3 text-left text-sm font-medium text-primary hover:bg-muted"
                      >
                        <Plus className="h-4 w-4" /> Add “{personQuery.trim()}”
                        as a new contact
                      </button>
                    )}
                  </SearchResults>
                )}
              </SearchField>

              <SearchField
                label="Organization"
                icon={Building2}
                value={organizationQuery}
                onChange={(nextValue) => {
                  setOrganizationQuery(nextValue);
                  if (!titleCustomized) setTitle(nextValue);
                  setAccountId(null);
                  setOrganizationOpen(true);
                }}
                onFocus={() => setOrganizationOpen(true)}
              >
                {organizationOpen && organizationQuery.trim() && (
                  <SearchResults>
                    {matchingAccounts.map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => {
                          setAccountId(account.id);
                          setOrganizationQuery(account.name);
                          if (!titleCustomized) setTitle(account.name);
                          setOrganizationOpen(false);
                        }}
                        className="block w-full px-4 py-3 text-left text-sm font-medium hover:bg-muted"
                      >
                        {account.name}
                      </button>
                    ))}
                    {!matchingAccounts.some(
                      (account) =>
                        account.name.toLowerCase() ===
                        organizationQuery.trim().toLowerCase(),
                    ) && (
                      <button
                        type="button"
                        onClick={() => setOrganizationOpen(false)}
                        className="flex w-full items-center gap-2 border-t px-4 py-3 text-left text-sm font-medium text-primary hover:bg-muted"
                      >
                        <Plus className="h-4 w-4" /> Add “
                        {organizationQuery.trim()}” as a new organization
                      </button>
                    )}
                  </SearchResults>
                )}
              </SearchField>

              <div className="grid gap-2">
                <Label htmlFor="lead-title">Title *</Label>
                <Input
                  id="lead-title"
                  required
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setTitleCustomized(true);
                  }}
                  placeholder="Lead title"
                />
              </div>
              <div className="grid grid-cols-[1fr_150px] gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="lead-value">Value</Label>
                  <Input
                    id="lead-value"
                    type="number"
                    min="0"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Currency</Label>
                  <Select
                    value={currency}
                    onValueChange={(next) =>
                      setCurrency(next as typeof currency)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["INR", "USD", "EUR", "GBP"] as const).map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Labels</Label>
                <LabelPicker
                  value={labels.join(", ")}
                  options={LEAD_LABELS}
                  onChange={(nextValue) =>
                    setLabels(
                      nextValue
                        .split(",")
                        .map((label) => label.trim())
                        .filter(Boolean),
                    )
                  }
                  disabled={pending}
                />
              </div>
              <div className="grid gap-2">
                <Label>Owner</Label>
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {owners.map((owner) => (
                      <SelectItem key={owner.id} value={owner.id}>
                        {owner.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lead-close-date">Expected close date</Label>
                <Input
                  id="lead-close-date"
                  type="date"
                  value={expectedCloseAt}
                  onChange={(event) => setExpectedCloseAt(event.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Source channel</Label>
                  <Select
                    value={sourceChannel}
                    onValueChange={setSourceChannel}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manually created</SelectItem>
                      {SOURCE_CHANNELS.map((source) => (
                        <SelectItem key={source} value={source}>
                          {source}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lead-source-id">Source channel ID</Label>
                  <Input
                    id="lead-source-id"
                    value={sourceChannelId}
                    onChange={(event) => setSourceChannelId(event.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6 bg-muted/15 p-6">
              <MethodList
                icon={Phone}
                label="Phone"
                items={phones}
                onChange={setPhones}
                allowedTypes={["work", "home", "mobile", "other"]}
              />
              <MethodList
                icon={Mail}
                label="Email"
                items={emails}
                onChange={setEmails}
                allowedTypes={["work", "home", "other"]}
              />
              <div className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">
                Existing contact details are reused. If the person or
                organization does not exist, it will be created when you save
                the lead.
              </div>
            </div>
          </div>
          <DialogFooter className="border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SearchField({
  label,
  icon: Icon,
  value,
  onChange,
  onFocus,
  children,
}: {
  label: string;
  icon: typeof UserRound;
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative grid gap-2">
      <Label>{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          className="pl-9"
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function SearchResults({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border bg-popover shadow-xl">
      {children}
    </div>
  );
}

function MethodList({
  icon: Icon,
  label,
  items,
  onChange,
  allowedTypes,
}: {
  icon: typeof Phone;
  label: string;
  items: ContactMethod[];
  onChange: (items: ContactMethod[]) => void;
  allowedTypes: ContactMethod["type"][];
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={`${label}-${index}`}
            className="grid grid-cols-[1fr_120px_auto] gap-2"
          >
            <Input
              type={label === "Email" ? "email" : "tel"}
              value={item.value}
              onChange={(event) =>
                onChange(
                  items.map((current, currentIndex) =>
                    currentIndex === index
                      ? { ...current, value: event.target.value }
                      : current,
                  ),
                )
              }
            />
            <Select
              value={item.type}
              onValueChange={(type) =>
                onChange(
                  items.map((current, currentIndex) =>
                    currentIndex === index
                      ? { ...current, type: type as ContactMethod["type"] }
                      : current,
                  ),
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedTypes.map((type) => (
                  <SelectItem key={type} value={type} className="capitalize">
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={items.length === 1}
              onClick={() =>
                onChange(
                  items.filter((_, currentIndex) => currentIndex !== index),
                )
              }
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2 text-primary"
        onClick={() => onChange([...items, emptyMethod()])}
      >
        <Plus className="mr-1.5 h-4 w-4" /> Add {label.toLowerCase()}
      </Button>
    </section>
  );
}
