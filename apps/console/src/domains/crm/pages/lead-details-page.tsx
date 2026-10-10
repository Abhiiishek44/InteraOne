import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Archive,
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  Tag,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  useAccounts,
  useUpdateAccount,
} from "@/domains/accounts/hooks/use-accounts";
import {
  useContactOwners,
  useContacts,
  useUpdateContact,
} from "@/domains/contacts/hooks/use-contacts";
import {
  ActivityWorkspaceComposer,
  ActivityWorkspaceEmpty,
  ActivityWorkspaceHistoryFilters,
  ActivityWorkspaceSectionHeader,
  type ActivityWorkspaceTab,
} from "../components/activity-workspace-ui";
import {
  useAddOpportunityActivity,
  useArchiveLead,
  useCompleteOpportunityActivity,
  useConvertLead,
  useLeads,
  useUpdateOpportunity,
} from "../hooks/use-opportunities";

type HistoryFilter = "all" | "activities" | "notes";
type EditableLeadField =
  | "title"
  | "labels"
  | "value"
  | "expectedCloseAt"
  | "ownerId"
  | "sourceOrigin"
  | "sourceChannel"
  | "sourceChannelId"
  | "contactId"
  | "phone"
  | "email"
  | "accountId"
  | "accountLabels"
  | "address"
  | "website"
  | "linkedinProfile"
  | "industry"
  | "annualRevenue"
  | "numberOfEmployees";

const money = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);

export function LeadDetailsPage() {
  const navigate = useNavigate();
  const { leadId } = useParams<{ leadId: string }>();
  const { data: leads = [], isLoading } = useLeads();
  const { data: contacts = [] } = useContacts();
  const { data: accountsData } = useAccounts("", 200);
  const { data: owners = [] } = useContactOwners();
  const lead = leads.find((item) => item.id === leadId);
  const addActivity = useAddOpportunityActivity();
  const completeActivity = useCompleteOpportunityActivity();
  const updateLead = useUpdateOpportunity();
  const convertLead = useConvertLead();
  const archiveLead = useArchiveLead();
  const updateContact = useUpdateContact();
  const updateAccount = useUpdateAccount();
  const [tab, setTab] = useState<ActivityWorkspaceTab>("notes");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState("");
  const [activityTitle, setActivityTitle] = useState("");
  const [activityAt, setActivityAt] = useState("");
  const [editingField, setEditingField] = useState<EditableLeadField | null>(
    null,
  );
  const [editValue, setEditValue] = useState("");
  const [editCurrency, setEditCurrency] = useState<
    "USD" | "INR" | "EUR" | "GBP"
  >("INR");
  const [editMethodType, setEditMethodType] = useState<
    "work" | "home" | "mobile" | "other"
  >("work");

  const planned = useMemo(
    () =>
      (lead?.activities || [])
        .filter(
          (activity) => activity.type === "planned" && !activity.completedAt,
        )
        .sort(
          (a, b) =>
            new Date(a.dueAt || 0).getTime() - new Date(b.dueAt || 0).getTime(),
        ),
    [lead?.activities],
  );
  const history = useMemo(() => {
    const items = lead?.activities || [];
    if (historyFilter === "notes")
      return items.filter((item) => item.type === "note");
    if (historyFilter === "activities")
      return items.filter((item) => item.type !== "note");
    return items;
  }, [historyFilter, lead?.activities]);

  if (isLoading)
    return (
      <div className="py-20 text-center text-muted-foreground">
        Loading lead…
      </div>
    );
  if (!lead) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <h1 className="text-lg font-semibold">Lead not found</h1>
          <Button
            className="mt-4"
            onClick={() => navigate("/dashboard/crm/leads")}
          >
            Back to leads
          </Button>
        </CardContent>
      </Card>
    );
  }

  const saveNote = async () => {
    if (!note.trim()) return;
    try {
      await addActivity.mutateAsync({
        id: lead.id,
        content: note.trim(),
        category: "todo",
      });
      setNote("");
      toast.success("Note added");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add note",
      );
    }
  };

  const scheduleActivity = async () => {
    if (!activityTitle.trim() || !activityAt) return;
    try {
      await addActivity.mutateAsync({
        id: lead.id,
        content: activityTitle.trim(),
        dueAt: new Date(activityAt).toISOString(),
        category: "call",
      });
      setActivityTitle("");
      setActivityAt("");
      toast.success("Activity scheduled");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to schedule activity",
      );
    }
  };

  const beginEdit = (field: EditableLeadField, value: string) => {
    setEditingField(field);
    setEditValue(value);
    if (field === "value") setEditCurrency(lead.currency);
    if (field === "phone")
      setEditMethodType(lead.contact?.phones?.[0]?.type || "work");
    if (field === "email")
      setEditMethodType(lead.contact?.emails?.[0]?.type || "work");
  };

  const saveField = async () => {
    if (!editingField) return;
    try {
      if (["phone", "email"].includes(editingField)) {
        if (!lead.contact?.id)
          throw new Error("Link a contact before editing this field");
        if (editingField === "phone") {
          await updateContact.mutateAsync({
            id: lead.contact.id,
            phone: editValue.trim(),
            phones: [
              { value: editValue.trim(), type: editMethodType },
              ...(lead.contact.phones || []).slice(1),
            ].filter((item) => item.value),
          });
        } else {
          await updateContact.mutateAsync({
            id: lead.contact.id,
            email: editValue.trim(),
            emails: [
              { value: editValue.trim(), type: editMethodType },
              ...(lead.contact.emails || []).slice(1),
            ].filter((item) => item.value),
          });
        }
      } else if (
        [
          "accountLabels",
          "address",
          "website",
          "linkedinProfile",
          "industry",
          "annualRevenue",
          "numberOfEmployees",
        ].includes(editingField)
      ) {
        if (!lead.account?.id)
          throw new Error("Link an organization before editing this field");
        await updateAccount.mutateAsync({
          id: lead.account.id,
          payload: {
            [editingField === "accountLabels" ? "labels" : editingField]:
              editingField === "accountLabels"
                ? editValue
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean)
                : editingField === "numberOfEmployees" ||
                    editingField === "annualRevenue"
                ? editValue
                  ? Number(editValue)
                  : null
                : editValue.trim(),
          },
        });
      } else {
        const value =
          editingField === "value"
            ? Number(editValue) || 0
            : editingField === "labels"
              ? editValue
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              : editingField === "ownerId" ||
                  editingField === "contactId" ||
                  editingField === "accountId"
                ? editValue === "none"
                  ? null
                  : editValue
                : editingField === "expectedCloseAt"
                  ? editValue || null
                  : editValue.trim();
        const apiField =
          editingField === "contactId" ? "primaryContactId" : editingField;
        await updateLead.mutateAsync({
          id: lead.id,
          [apiField]: value,
          ...(editingField === "value" ? { currency: editCurrency } : {}),
        });
      }
      setEditingField(null);
      toast.success("Field updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update field",
      );
    }
  };

  return (
    <div className="-m-4 flex min-h-[calc(100vh-4rem)] flex-col bg-muted/20 sm:-m-6">
      <header className="flex items-center justify-between gap-3 border-b bg-background px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard/crm/leads")}
            title="Back to leads"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{lead.title}</h1>
            <p className="text-xs text-muted-foreground">Lead workspace</p>
          </div>
        </div>
        <span className="hidden text-xs text-muted-foreground sm:block">
          Select any field in the left panel to edit it
        </span>
      </header>

      <div className="grid flex-1 lg:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="flex max-h-[calc(100vh-8rem)] flex-col border-r bg-background">
          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            <LeadSection title="Summary">
              <div className="space-y-1">
                <EditableDetail
                  icon={Pencil}
                  field="title"
                  label="Title"
                  value={lead.title}
                  rawValue={lead.title}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateLead.isPending}
                />
                <EditableDetail
                  icon={Tag}
                  field="labels"
                  label="Labels"
                  value={
                    lead.labels?.length ? lead.labels.join(", ") : "No labels"
                  }
                  rawValue={(lead.labels || []).join(", ")}
                  placeholder="HOT LEAD, WARM LEAD"
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateLead.isPending}
                />
                <EditableDetail
                  icon={CircleDollarSign}
                  field="value"
                  label="Value"
                  value={money(lead.value, lead.currency)}
                  rawValue={String(lead.value)}
                  inputType="number"
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateLead.isPending}
                />
                <EditableDetail
                  icon={CalendarDays}
                  field="expectedCloseAt"
                  label="Expected close"
                  value={
                    lead.expectedCloseAt
                      ? new Date(lead.expectedCloseAt).toLocaleDateString()
                      : "Not set"
                  }
                  rawValue={lead.expectedCloseAt?.slice(0, 10) || ""}
                  inputType="date"
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateLead.isPending}
                />
              </div>
            </LeadSection>

            <LeadSection title="Details">
              <div className="space-y-1">
                <EditableDetail
                  icon={UserRound}
                  field="ownerId"
                  label="Owner"
                  value={lead.owner?.name || "Unassigned"}
                  rawValue={lead.owner?.id || "none"}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateLead.isPending}
                  editor={
                    <Select value={editValue} onValueChange={setEditValue}>
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
                  }
                />
                <EditableDetail
                  icon={ExternalLink}
                  field="sourceOrigin"
                  label="Source origin"
                  value={
                    lead.sourceOrigin === "manual"
                      ? "Manually created"
                      : lead.sourceOrigin || "Unknown"
                  }
                  rawValue={lead.sourceOrigin || "manual"}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateLead.isPending}
                />
                <EditableDetail
                  icon={ExternalLink}
                  field="sourceChannel"
                  label="Source channel"
                  value={lead.sourceChannel || "Not set"}
                  rawValue={lead.sourceChannel || ""}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateLead.isPending}
                />
                <EditableDetail
                  icon={ExternalLink}
                  field="sourceChannelId"
                  label="Source channel ID"
                  value={lead.sourceChannelId || "Not set"}
                  rawValue={lead.sourceChannelId || ""}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateLead.isPending}
                />
              </div>
            </LeadSection>

            <LeadSection title="Person">
              <div className="space-y-1">
                <EditableDetail
                  icon={UserRound}
                  field="contactId"
                  label="Contact"
                  value={lead.contact?.name || "Not linked"}
                  rawValue={lead.contact?.id || "none"}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateLead.isPending}
                  editor={
                    <Select value={editValue} onValueChange={setEditValue}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not linked</SelectItem>
                        {contacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.name}
                            {contact.company ? ` · ${contact.company}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  }
                />
                <EditableDetail
                  icon={Phone}
                  field="phone"
                  label="Phone"
                  value={lead.contact?.phone || "Not provided"}
                  rawValue={lead.contact?.phone || ""}
                  inputType="tel"
                  disabled={!lead.contact?.id}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateContact.isPending}
                />
                <EditableDetail
                  icon={Mail}
                  field="email"
                  label="Email"
                  value={lead.contact?.email || "Not provided"}
                  rawValue={lead.contact?.email || ""}
                  inputType="email"
                  disabled={!lead.contact?.id}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateContact.isPending}
                />
              </div>
            </LeadSection>

            <LeadSection title="Organization">
              <div className="space-y-1">
                <EditableDetail
                  icon={Building2}
                  field="accountId"
                  label="Organization"
                  value={lead.account?.name || lead.company || "Not linked"}
                  rawValue={lead.account?.id || "none"}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateLead.isPending}
                  editor={
                    <Select value={editValue} onValueChange={setEditValue}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not linked</SelectItem>
                        {(accountsData?.accounts || []).map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  }
                />
                <EditableDetail
                  icon={MapPin}
                  field="address"
                  label="Address"
                  value={lead.account?.address || "Not provided"}
                  rawValue={lead.account?.address || ""}
                  disabled={!lead.account?.id}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateAccount.isPending}
                />
                <EditableDetail
                  icon={ExternalLink}
                  field="website"
                  label="Website"
                  value={lead.account?.website || "Not provided"}
                  rawValue={lead.account?.website || ""}
                  inputType="url"
                  disabled={!lead.account?.id}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateAccount.isPending}
                />
                <EditableDetail
                  icon={Building2}
                  field="industry"
                  label="Industry"
                  value={lead.account?.industry || "Not provided"}
                  rawValue={lead.account?.industry || ""}
                  disabled={!lead.account?.id}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateAccount.isPending}
                />
                <EditableDetail
                  icon={UserRound}
                  field="numberOfEmployees"
                  label="No. of employees"
                  value={
                    lead.account?.numberOfEmployees?.toString() ||
                    "Not provided"
                  }
                  rawValue={lead.account?.numberOfEmployees?.toString() || ""}
                  inputType="number"
                  disabled={!lead.account?.id}
                  editingField={editingField}
                  editValue={editValue}
                  onBegin={beginEdit}
                  onChange={setEditValue}
                  onSave={saveField}
                  onCancel={() => setEditingField(null)}
                  saving={updateAccount.isPending}
                />
              </div>
            </LeadSection>
          </div>
          <div className="flex items-center justify-end gap-2 border-t p-4">
            <Button
              variant="outline"
              onClick={async () => {
                await archiveLead.mutateAsync(lead.id);
                toast.success("Lead archived");
                navigate("/dashboard/crm/leads");
              }}
              disabled={archiveLead.isPending}
            >
              <Archive className="mr-2 h-4 w-4" /> Archive
            </Button>
            <Button
              onClick={async () => {
                await convertLead.mutateAsync(lead.id);
                toast.success("Lead converted to deal");
                navigate(`/dashboard/crm/pipeline/${lead.id}`);
              }}
              disabled={convertLead.isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Convert to deal
            </Button>
          </div>
        </aside>

        <main className="max-h-[calc(100vh-8rem)] overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-5xl space-y-7">
            <ActivityWorkspaceComposer tab={tab} onTabChange={setTab}>
              {tab === "notes" ? (
                <div>
                  <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Take a note…"
                    className="min-h-24 resize-none border-0 px-0 shadow-none focus-visible:ring-0"
                  />
                  <div className="flex justify-end border-t pt-3">
                    <Button
                      size="sm"
                      onClick={saveNote}
                      disabled={!note.trim() || addActivity.isPending}
                    >
                      Save note
                    </Button>
                  </div>
                </div>
              ) : tab === "activity" || tab === "call" ? (
                <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-end">
                  <div className="grid gap-2">
                    <Label>Activity</Label>
                    <Input
                      value={activityTitle}
                      onChange={(event) => setActivityTitle(event.target.value)}
                      placeholder={tab === "call" ? "Call" : "Activity title"}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Date and time</Label>
                    <Input
                      type="datetime-local"
                      value={activityAt}
                      onChange={(event) => setActivityAt(event.target.value)}
                    />
                  </div>
                  <Button
                    onClick={scheduleActivity}
                    disabled={!activityTitle.trim() || !activityAt}
                  >
                    Schedule
                  </Button>
                </div>
              ) : (
                <ActivityWorkspaceEmpty
                  title={`${tab[0].toUpperCase()}${tab.slice(1)}`}
                  description="This channel will appear in the lead history when an item is added."
                />
              )}
            </ActivityWorkspaceComposer>

            <section className="space-y-4">
              <ActivityWorkspaceSectionHeader
                title="Focus"
                expanded={expanded}
                onExpandedChange={setExpanded}
              />
              {planned.length ? (
                <div className="space-y-3">
                  {(expanded ? planned : planned.slice(0, 3)).map(
                    (activity) => (
                      <Card key={activity.id}>
                        <CardContent className="flex items-center gap-3 p-4">
                          <button
                            type="button"
                            onClick={() =>
                              completeActivity.mutate({
                                id: lead.id,
                                activityId: activity.id,
                              })
                            }
                            className="flex h-5 w-5 items-center justify-center rounded-full border hover:border-emerald-500 hover:text-emerald-600"
                            title="Mark as done"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {activity.content}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {activity.dueAt
                                ? new Date(activity.dueAt).toLocaleString()
                                : "No due date"}
                            </p>
                          </div>
                          <Badge variant="outline" className="capitalize">
                            {activity.category}
                          </Badge>
                        </CardContent>
                      </Card>
                    ),
                  )}
                </div>
              ) : (
                <ActivityWorkspaceEmpty
                  title="No focus items yet"
                  description="Scheduled activities, pinned notes, and follow-ups will appear here."
                />
              )}
            </section>

            <section>
              <ActivityWorkspaceSectionHeader title="History" />
              <div className="mt-4">
                <ActivityWorkspaceHistoryFilters
                  filters={[
                    { id: "all", label: "All" },
                    {
                      id: "activities",
                      label: "Activities",
                      count: lead.activities.filter(
                        (item) => item.type !== "note",
                      ).length,
                    },
                    {
                      id: "notes",
                      label: "Notes",
                      count: lead.activities.filter(
                        (item) => item.type === "note",
                      ).length,
                    },
                  ]}
                  active={historyFilter}
                  onChange={setHistoryFilter}
                />
                <div className="relative space-y-3 before:absolute before:bottom-4 before:left-5 before:top-4 before:w-px before:bg-border">
                  {history.map((activity) => (
                    <div key={activity.id} className="relative flex gap-3">
                      <span className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background">
                        <Clock3 className="h-4 w-4 text-muted-foreground" />
                      </span>
                      <Card className="flex-1">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium">{activity.content}</p>
                            <Badge variant="outline" className="capitalize">
                              {activity.type}
                            </Badge>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {new Date(activity.createdAt).toLocaleString()} ·{" "}
                            {lead.owner?.name || "Workspace"}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                  {!history.length && (
                    <ActivityWorkspaceEmpty
                      title="No history yet"
                      description="Lead notes and activities will appear here."
                    />
                  )}
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function LeadSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function EditableDetail({
  icon: Icon,
  field,
  label,
  value,
  rawValue,
  editingField,
  editValue,
  onBegin,
  onChange,
  onSave,
  onCancel,
  saving,
  inputType = "text",
  placeholder,
  disabled = false,
  editor,
}: {
  icon: typeof UserRound;
  field: EditableLeadField;
  label: string;
  value: string;
  rawValue: string;
  editingField: EditableLeadField | null;
  editValue: string;
  onBegin: (field: EditableLeadField, value: string) => void;
  onChange: (value: string) => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  inputType?: string;
  placeholder?: string;
  disabled?: boolean;
  editor?: ReactNode;
}) {
  const editing = editingField === field;
  return (
    <div
      className={`rounded-lg px-2 py-2 transition-colors ${editing ? "bg-muted/60" : "group hover:bg-muted/40"}`}
    >
      {editing ? (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          {editor || (
            <Input
              autoFocus
              type={inputType}
              value={editValue}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onSave();
                }
                if (event.key === "Escape") onCancel();
              }}
              placeholder={placeholder}
              min={inputType === "number" ? "0" : undefined}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void onSave()}
              disabled={saving || (field === "title" && !editValue.trim())}
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => !disabled && onBegin(field, rawValue)}
          disabled={disabled}
          className="flex w-full items-start gap-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60"
          title={
            disabled
              ? `Link a ${field === "phone" || field === "email" ? "contact" : "organization"} to edit ${label.toLowerCase()}`
              : `Edit ${label.toLowerCase()}`
          }
        >
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{value}</span>
            <span className="block text-xs text-muted-foreground">{label}</span>
          </span>
          {!disabled && (
            <Pencil className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </button>
      )}
    </div>
  );
}
