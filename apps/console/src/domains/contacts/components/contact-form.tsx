import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { User, Loader2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { useContactOwners, useUpdateContact } from "../hooks/use-contacts";
import { useUpdateContactAssociation } from "@/domains/conversation/hooks";
import { useAccounts } from "@/domains/accounts/hooks/use-accounts";
import type {
  ContactAcquisitionSource,
  ContactChannel,
  ContactLeadStatus,
  ContactLifecycleStage,
  ContactWritePayload,
} from "../types/types";

type ContactFormPayload = ContactWritePayload & {
  name: string;
  tags: string[];
};

const toLocalDateTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

interface ContactFormProps {
  mode: "create" | "update";
  initialValues?: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    accountId?: string | null;
    tags?: string[];
    lifecycleStage?: ContactLifecycleStage;
    leadStatus?: ContactLeadStatus;
    ownerId?: string | null;
    acquisitionSource?: ContactAcquisitionSource;
    preferredChannel?: ContactChannel | null;
    nextFollowUpAt?: string | null;
  };
  onSubmit: (payload: ContactFormPayload) => void | Promise<void>;
  onCancel: () => void;
  tagOptions: string[];
  loading?: boolean;
  ownerOptions?: Array<{ id: string; name: string }>;
}

export function ContactForm({
  mode,
  initialValues,
  onSubmit,
  onCancel,
  tagOptions,
  loading = false,
  ownerOptions = [],
}: ContactFormProps) {
  const [name, setName] = useState(initialValues?.name || "");
  const [email, setEmail] = useState(initialValues?.email || "");
  const [phone, setPhone] = useState(initialValues?.phone || "");
  const [company, setCompany] = useState(initialValues?.company || "");
  const [accountId, setAccountId] = useState(initialValues?.accountId || "");
  const { data: accountsData } = useAccounts("", 100);
  const [tags, setTags] = useState<string[]>(initialValues?.tags || []);
  const [lifecycleStage, setLifecycleStage] = useState<ContactLifecycleStage>(
    initialValues?.lifecycleStage || "new",
  );
  const [leadStatus, setLeadStatus] = useState<ContactLeadStatus>(
    initialValues?.leadStatus || "needs_review",
  );
  const [ownerId, setOwnerId] = useState(initialValues?.ownerId || "");
  const [acquisitionSource, setAcquisitionSource] =
    useState<ContactAcquisitionSource>(
      initialValues?.acquisitionSource || "manual",
    );
  const [preferredChannel, setPreferredChannel] = useState<ContactChannel | "">(
    initialValues?.preferredChannel || "",
  );
  const [nextFollowUpAt, setNextFollowUpAt] = useState(
    toLocalDateTime(initialValues?.nextFollowUpAt),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      company: company.trim() || undefined,
      accountId: accountId || null,
      tags,
      lifecycleStage,
      leadStatus,
      ownerId: ownerId || null,
      acquisitionSource,
      preferredChannel: preferredChannel || null,
      nextFollowUpAt: nextFollowUpAt
        ? new Date(nextFollowUpAt).toISOString()
        : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="contact-name">Name</Label>
          <Input
            id="contact-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Full name"
            className="cursor-text"
            required
            disabled={loading}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="contact-email">Email</Label>
          <Input
            id="contact-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email@company.com"
            className="cursor-text"
            disabled={loading}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="contact-phone">Phone</Label>
          <Input
            id="contact-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+1 (555) 000-0000"
            className="cursor-text"
            disabled={loading}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="contact-company">Company</Label>
          <Select
            value={accountId || "legacy"}
            onValueChange={(value) => {
              const nextId = value === "legacy" ? "" : value;
              setAccountId(nextId);
              const selected = accountsData?.accounts.find((item) => item.id === nextId);
              if (selected) setCompany(selected.name);
            }}
            disabled={loading}
          >
            <SelectTrigger id="contact-company"><SelectValue placeholder="Select a company" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="legacy">No linked company</SelectItem>
              {(accountsData?.accounts || []).map((account) => (
                <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!accountId && (
            <Input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="Legacy company name (optional)"
              className="cursor-text"
              disabled={loading}
            />
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
        <div>
          <h3 className="text-sm font-semibold">CRM details</h3>
          <p className="text-xs text-muted-foreground">
            Track ownership, qualification, and the next action.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="contact-lifecycle-stage">Lifecycle stage</Label>
            <Select
              value={lifecycleStage}
              onValueChange={(value) =>
                setLifecycleStage(value as ContactLifecycleStage)
              }
              disabled={loading}
            >
              <SelectTrigger id="contact-lifecycle-stage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="opportunity">Opportunity</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-lead-status">Lead status</Label>
            <Select
              value={leadStatus}
              onValueChange={(value) =>
                setLeadStatus(value as ContactLeadStatus)
              }
              disabled={loading}
            >
              <SelectTrigger id="contact-lead-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="needs_review">Needs review</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="unqualified">Unqualified</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-owner">Contact owner</Label>
            <Select
              value={ownerId || "unassigned"}
              onValueChange={(value) =>
                setOwnerId(value === "unassigned" ? "" : value)
              }
              disabled={loading}
            >
              <SelectTrigger id="contact-owner">
                <SelectValue />
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
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-source">Acquisition source</Label>
            <Select
              value={acquisitionSource}
              onValueChange={(value) =>
                setAcquisitionSource(value as ContactAcquisitionSource)
              }
              disabled={loading}
            >
              <SelectTrigger id="contact-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="widget">Widget</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="telegram">Telegram</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="qr">QR</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-preferred-channel">Preferred channel</Label>
            <Select
              value={preferredChannel || "not_set"}
              onValueChange={(value) =>
                setPreferredChannel(
                  value === "not_set" ? "" : (value as ContactChannel),
                )
              }
              disabled={loading}
            >
              <SelectTrigger id="contact-preferred-channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_set">Not set</SelectItem>
                <SelectItem value="widget">Widget</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="telegram">Telegram</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-next-follow-up">Next follow-up</Label>
            <Input
              id="contact-next-follow-up"
              type="datetime-local"
              value={nextFollowUpAt}
              onChange={(event) => setNextFollowUpAt(event.target.value)}
              disabled={loading}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Tags</Label>
        <div className="flex flex-wrap gap-2">
          {tagOptions.map((tag) => (
            <button
              key={tag}
              type="button"
              disabled={loading}
              onClick={() =>
                setTags((prev) =>
                  prev.includes(tag)
                    ? prev.filter((item) => item !== tag)
                    : [...prev, tag],
                )
              }
              className={`rounded-full border px-3 py-1 text-xs transition-colors cursor-pointer ${
                tags.includes(tag)
                  ? "bg-primary text-primary-foreground border-transparent"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <DialogFooter className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="cursor-pointer"
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!name.trim() || loading}
          className="cursor-pointer"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "Create contact" : "Update"}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface ContactDialogProps {
  mode: "create" | "update";
  contactId?: string;
  conversationId?: string;
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    accountId?: string | null;
    tags?: string[];
    lifecycleStage?: ContactLifecycleStage;
    leadStatus?: ContactLeadStatus;
    ownerId?: string | null;
    acquisitionSource?: ContactAcquisitionSource;
    preferredChannel?: ContactChannel | null;
    nextFollowUpAt?: string | null;
  };
  triggerType?: "button" | "icon" | "custom";
  customTrigger?: React.ReactNode;
  onSubmit?: (payload: ContactFormPayload) => void | Promise<void>;
  onSuccess?: (updatedContact: {
    name: string;
    email: string;
    phone: string;
    company: string;
    tags: string[];
  }) => void;
}

export function ContactDialog({
  mode,
  contactId,
  conversationId,
  contact,
  triggerType = "button",
  customTrigger,
  onSubmit,
  onSuccess,
}: ContactDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const updateContactMutation = useUpdateContact();
  const associateContactMutation = useUpdateContactAssociation();
  const { data: ownerOptions = [] } = useContactOwners();

  const TAG_OPTIONS = ["VIP", "Enterprise", "Trial", "Billing", "At Risk"];

  const handleFormSubmit = async (payload: ContactFormPayload) => {
    if (mode === "create") {
      setLoading(true);
      try {
        await onSubmit?.(payload);
        setOpen(false);
        toast.success("Contact created successfully");
      } catch (error: unknown) {
        toast.error(
          error instanceof Error ? error.message : "Failed to create contact",
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    const trimmedName = payload.name.trim();
    const trimmedEmail = payload.email?.trim() || "";
    const trimmedPhone = payload.phone?.trim() || "";
    const trimmedCompany = payload.company?.trim() || "";
    const tags = payload.tags;

    if (
      !trimmedName &&
      !trimmedEmail &&
      !trimmedPhone &&
      !trimmedCompany &&
      tags.length === 0
    ) {
      toast.error(
        "Please provide at least a name, email address, phone number, company name, or tags to update.",
      );
      return;
    }

    setLoading(true);
    try {
      if (!contactId || contactId === "temp-contact") {
        if (!conversationId) {
          toast.error(
            "Cannot associate contact: conversation context is missing.",
          );
          setLoading(false);
          return;
        }
        await associateContactMutation.mutateAsync({
          conversationId,
          name: trimmedName || undefined,
          email: trimmedEmail || undefined,
          phone: trimmedPhone || undefined,
          company: trimmedCompany || undefined,
          tags,
        });
        toast.success("Contact associated successfully");
        setOpen(false);
        onSuccess?.({
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          company: trimmedCompany,
          tags,
        });
        return;
      }

      await updateContactMutation.mutateAsync({
        id: contactId,
        ...payload,
        name: trimmedName || undefined,
        email: trimmedEmail,
        phone: trimmedPhone,
        company: trimmedCompany,
      });

      toast.success("Details updated successfully");
      setOpen(false);
      onSuccess?.({
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        company: trimmedCompany,
        tags,
      });
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update details",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerType === "custom" && customTrigger ? (
          customTrigger
        ) : triggerType === "icon" ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Edit contact details"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="cursor-pointer">
            <User className="h-4 w-4 mr-2" />
            {mode === "create" ? "Add contact" : "Update Info"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-180">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Add new contact"
              : "Update Customer Information"}
          </DialogTitle>
          {mode === "create" && (
            <DialogDescription>
              Capture customer details so agents can provide faster, more
              personal support.
            </DialogDescription>
          )}
        </DialogHeader>
        <ContactForm
          key={`${mode}:${contactId || "new"}:${JSON.stringify(contact || {})}`}
          mode={mode}
          initialValues={contact}
          onSubmit={handleFormSubmit}
          onCancel={() => setOpen(false)}
          tagOptions={TAG_OPTIONS}
          loading={loading}
          ownerOptions={ownerOptions}
        />
      </DialogContent>
    </Dialog>
  );
}
