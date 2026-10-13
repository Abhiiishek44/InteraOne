import {
  useEffect,
  useMemo,
  useState,
  type FocusEvent,
  type FormEvent,
} from "react";
import {
  Building2,
  Check,
  Info,
  Loader2,
  Mail,
  Phone,
  Plus,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
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
import { LabelPicker } from "@/shared/components/label-editor";
import type {
  ContactListItem,
  ContactMethodType,
  ContactOwner,
} from "@/domains/contacts/types/types";
import {
  useContactsPage,
  useCreateContact,
} from "@/domains/contacts/hooks/use-contacts";
import { useAccounts } from "@/domains/accounts/hooks/use-accounts";
import {
  useCreateCrmRecord,
  useUpdateCrmRecord,
} from "../hooks/use-crm-records";
import type {
  CreateCrmRecordPayload,
  CrmRecord,
  PipelineStage,
} from "../types/types";

interface DealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStage?: string;
  stages: PipelineStage[];
  owners: ContactOwner[];
  deal?: CrmRecord;
}

const emptyForm: CreateCrmRecordPayload = {
  contactId: "",
  primaryContactId: null,
  accountId: null,
  title: "",
  company: "",
  value: 0,
  currency: "INR",
  stage: "",
  labels: [],
  ownerId: null,
  expectedCloseAt: null,
  nextAction: "",
  customFields: {},
};
const methodTypes: ContactMethodType[] = ["work", "mobile", "home", "other"];

function FieldLabel({ children, info }: { children: string; info?: boolean }) {
  return (
    <Label className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
      {children}
      {info && <Info className="h-3.5 w-3.5" />}
    </Label>
  );
}

export function DealDialog({
  open,
  onOpenChange,
  initialStage,
  stages,
  owners,
  deal,
}: DealDialogProps) {
  const isEditing = Boolean(deal);
  const createDeal = useCreateCrmRecord();
  const updateDeal = useUpdateCrmRecord();
  const createContact = useCreateContact();
  const { data: accountsData } = useAccounts("", 100);
  const [form, setForm] = useState<CreateCrmRecordPayload>(emptyForm);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [debouncedContactSearch, setDebouncedContactSearch] = useState("");
  const [selectedContact, setSelectedContact] =
    useState<ContactListItem | null>(null);
  const [creatingContact, setCreatingContact] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneType, setPhoneType] = useState<ContactMethodType>("work");
  const [email, setEmail] = useState("");
  const [emailType, setEmailType] = useState<ContactMethodType>("work");

  const { data: contactResults, isFetching: contactsLoading } = useContactsPage(
    { search: debouncedContactSearch, page: 1, limit: 10, sort: "name" },
    {
      enabled:
        open && contactPickerOpen && debouncedContactSearch.trim().length > 0,
    },
  );
  const labelOptions = useMemo(
    () =>
      Array.from(
        new Set([
          "Customer",
          "VIP",
          "Warm lead",
          "Hot lead",
          "Cold lead",
          ...(accountsData?.accounts || []).flatMap((account) => [
            ...(account.labels || []),
            ...(account.tags || []),
          ]),
          ...(form.labels || []),
        ]),
      ),
    [accountsData?.accounts, form.labels],
  );

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedContactSearch(contactSearch.trim()),
      250,
    );
    return () => window.clearTimeout(timeout);
  }, [contactSearch]);

  useEffect(() => {
    if (!open) return;
    const firstOpen = stages.find((stage) => stage.type === "open");
    const timeout = window.setTimeout(() => {
      setContactPickerOpen(false);
      setCreatingContact(false);
      setSelectedContact(null);
      setContactSearch(deal?.contact?.name || "");
      setPhone(deal?.contact?.phone || "");
      setEmail(deal?.contact?.email || "");
      setPhoneType("work");
      setEmailType("work");
      setForm(
        deal
          ? {
              contactId: deal.contact?.id || "",
              primaryContactId: deal.contact?.id || null,
              accountId: deal.account?.id || null,
              title: deal.title,
              company: deal.company || deal.account?.name || "",
              value: deal.value,
              currency: deal.currency,
              stage: deal.stage,
              labels: deal.labels || [],
              ownerId: deal.owner?.id || null,
              expectedCloseAt: deal.expectedCloseAt?.slice(0, 10) || null,
              nextAction: deal.nextAction || "",
              customFields: deal.customFields || {},
            }
          : {
              ...emptyForm,
              stage: initialStage || firstOpen?.id || stages[0]?.id || "",
            },
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [initialStage, open, deal, stages]);

  const selectContact = (contact: ContactListItem) => {
    const organizationName = contact.account?.name || contact.company || "";
    setSelectedContact(contact);
    setCreatingContact(false);
    setContactSearch(contact.name);
    setPhone(contact.phone || contact.phones?.[0]?.value || "");
    setEmail(contact.email || contact.emails?.[0]?.value || "");
    setPhoneType(contact.phones?.[0]?.type || "work");
    setEmailType(contact.emails?.[0]?.type || "work");
    setContactPickerOpen(false);
    setForm((current) => ({
      ...current,
      contactId: contact.id,
      primaryContactId: contact.id,
      accountId: contact.account?.id || current.accountId,
      company: organizationName || current.company,
      title: current.title || organizationName || contact.name,
      ownerId: contact.owner?.id || current.ownerId,
    }));
  };
  const closeContactPickerOnBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null))
      setContactPickerOpen(false);
  };
  const chooseNewContact = () => {
    setSelectedContact(null);
    setCreatingContact(true);
    setContactPickerOpen(false);
    setForm((current) => ({
      ...current,
      contactId: null,
      primaryContactId: null,
      title: current.title || current.company || contactSearch.trim(),
    }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      let contactId = form.primaryContactId || form.contactId || null;
      if (!isEditing && creatingContact && contactSearch.trim()) {
        const created = await createContact.mutateAsync({
          name: contactSearch.trim(),
          email: email.trim(),
          phone: phone.trim(),
          emails: email.trim()
            ? [{ value: email.trim(), type: emailType }]
            : [],
          phones: phone.trim()
            ? [{ value: phone.trim(), type: phoneType }]
            : [],
          accountId: form.accountId || null,
          company: form.company || "",
          ownerId: form.ownerId || null,
          acquisitionSource: "manual",
        });
        contactId = created.id || created._id;
      }
      const expectedCloseAt = form.expectedCloseAt
        ? new Date(form.expectedCloseAt).toISOString()
        : null;
      const payload = {
        ...form,
        contactId,
        primaryContactId: contactId,
        expectedCloseAt,
      };
      if (deal) {
        await updateDeal.mutateAsync({
          id: deal.id,
          title: payload.title,
          company: payload.company,
          accountId: payload.accountId,
          primaryContactId: payload.primaryContactId,
          value: payload.value,
          currency: payload.currency,
          labels: payload.labels,
          ownerId: payload.ownerId,
          expectedCloseAt,
          nextAction: payload.nextAction,
          customFields: payload.customFields,
        });
        toast.success("Deal updated");
      } else {
        await createDeal.mutateAsync(payload);
        toast.success("Deal created");
      }
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${isEditing ? "update" : "create"} deal`,
      );
    }
  };

  const saving =
    createDeal.isPending || updateDeal.isPending || createContact.isPending;
  const selectedStageIndex = stages.findIndex(
    (stage) => stage.id === form.stage,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>{isEditing ? "Edit deal" : "Add deal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <div className="grid min-h-0 overflow-y-auto lg:grid-cols-2">
            <div className="space-y-4 border-r p-5">
              <div className="grid gap-1.5" onBlur={closeContactPickerOnBlur}>
                <FieldLabel info>Contact person</FieldLabel>
                <div className="relative">
                  <UserRound className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={contactSearch}
                    onFocus={() =>
                      setContactPickerOpen(Boolean(contactSearch.trim()))
                    }
                    onChange={(event) => {
                      setContactSearch(event.target.value);
                      setSelectedContact(null);
                      setCreatingContact(false);
                      setForm((current) => ({
                        ...current,
                        contactId: null,
                        primaryContactId: null,
                      }));
                      setContactPickerOpen(Boolean(event.target.value.trim()));
                    }}
                    placeholder="Search contacts"
                    className="pl-9 pr-14"
                  />
                  {contactSearch.trim() && !selectedContact && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      NEW
                    </span>
                  )}
                  {contactPickerOpen && contactSearch.trim() && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-popover shadow-xl">
                      <div className="max-h-52 overflow-y-auto p-1">
                        {contactsLoading ||
                        debouncedContactSearch !== contactSearch.trim() ? (
                          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />{" "}
                            Searching contacts…
                          </div>
                        ) : contactResults?.contacts.length ? (
                          contactResults.contacts.map((contact) => (
                            <button
                              key={contact.id}
                              type="button"
                              onClick={() => selectContact(contact)}
                              className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left hover:bg-muted"
                            >
                              <Check
                                className={`h-4 w-4 ${form.contactId === contact.id ? "opacity-100" : "opacity-0"}`}
                              />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">
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
                          <p className="px-3 py-5 text-center text-sm text-muted-foreground">
                            No contacts found
                          </p>
                        )}
                      </div>
                      {contactSearch.trim() && (
                        <button
                          type="button"
                          onClick={chooseNewContact}
                          className="flex w-full items-center gap-2 border-t px-4 py-3 text-left text-sm font-medium text-primary hover:bg-muted"
                        >
                          <Plus className="h-4 w-4" /> Add “
                          {contactSearch.trim()}” as new contact
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-1.5">
                <FieldLabel info>Organization</FieldLabel>
                <Select
                  value={form.accountId || "none"}
                  onValueChange={(value) => {
                    const accountId = value === "none" ? null : value;
                    const account = accountsData?.accounts.find(
                      (item) => item.id === accountId,
                    );
                    setForm((current) => ({
                      ...current,
                      accountId,
                      company: account?.name || "",
                      title: current.title || account?.name || "",
                      ownerId: current.ownerId || account?.owner?.id || null,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <span className="flex min-w-0 items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Select organization" />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No organization</SelectItem>
                    {(accountsData?.accounts || []).map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <FieldLabel>Title</FieldLabel>
                <Input
                  required
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <FieldLabel info>Value</FieldLabel>
                <div className="grid grid-cols-[minmax(0,1fr)_150px] gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={form.value || ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        value: Number(event.target.value),
                      }))
                    }
                  />
                  <Select
                    value={form.currency}
                    onValueChange={(currency) =>
                      setForm((current) => ({
                        ...current,
                        currency: currency as CrmRecord["currency"],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">Indian Rupee (INR)</SelectItem>
                      <SelectItem value="USD">US Dollar (USD)</SelectItem>
                      <SelectItem value="EUR">Euro (EUR)</SelectItem>
                      <SelectItem value="GBP">British Pound (GBP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <FieldLabel>Pipeline</FieldLabel>
                <Input value="Sales pipeline" disabled />
              </div>
              <div className="grid gap-1.5">
                <FieldLabel>Pipeline stage</FieldLabel>
                <div className="overflow-hidden rounded-md border bg-muted/15 p-1.5">
                  <div className="flex w-full items-center">
                    {stages.map((stage, index) => (
                      <button
                        key={stage.id}
                        type="button"
                        disabled={isEditing}
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            stage: stage.id,
                          }))
                        }
                        style={{
                          clipPath:
                            index === 0
                              ? "polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)"
                              : "polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%, 8px 50%)",
                        }}
                        className={`relative min-w-0 flex-1 whitespace-nowrap py-2 pl-2.5 pr-3 text-center text-[9px] font-semibold transition-colors first:pl-1.5 ${index > 0 ? "-ml-1.5" : ""} ${
                          index === selectedStageIndex
                            ? "z-20 bg-primary text-primary-foreground"
                            : index < selectedStageIndex
                              ? "z-10 bg-primary/15 text-primary hover:bg-primary/25"
                              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                        }`}
                      >
                        <span className="block">{stage.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-1.5">
                <FieldLabel info>Labels</FieldLabel>
                <LabelPicker
                  value={(form.labels || []).join(", ")}
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
                  disabled={saving}
                />
              </div>
              <div className="grid gap-1.5">
                <FieldLabel info>Expected close date</FieldLabel>
                <Input
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
              <div className="grid gap-1.5">
                <FieldLabel>Owner</FieldLabel>
                <Select
                  value={form.ownerId || "none"}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      ownerId: value === "none" ? null : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {owners.map((owner) => (
                      <SelectItem key={owner.id} value={owner.id}>
                        {owner.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide">
                <span>Person</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="grid gap-1.5">
                <FieldLabel>Phone</FieldLabel>
                <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-2">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={phoneType}
                    onValueChange={(value) =>
                      setPhoneType(value as ContactMethodType)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {methodTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <FieldLabel>Email</FieldLabel>
                <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-2">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={emailType}
                    onValueChange={(value) =>
                      setEmailType(value as ContactMethodType)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {methodTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5 pt-2">
                <FieldLabel>Next action</FieldLabel>
                <Input
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
              {creatingContact && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                  A new contact named <strong>{contactSearch.trim()}</strong>{" "}
                  will be created with this deal.
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="border-t bg-background px-5 py-4">
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
                saving ||
                !form.title.trim() ||
                !form.stage ||
                (!form.accountId && !form.contactId && !creatingContact)
              }
            >
              {saving ? "Saving…" : isEditing ? "Save changes" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
