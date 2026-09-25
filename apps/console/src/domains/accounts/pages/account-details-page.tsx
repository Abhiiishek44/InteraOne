import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { Building2, ExternalLink, Mail, Phone, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  useAccount,
  useAddAccountNote,
  useUpdateAccount,
} from "../hooks/use-accounts";
import { useContactOwners } from "@/domains/contacts/hooks/use-contacts";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Loader } from "@/shared/ui/loader";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { InlineCustomFields } from "@/domains/crm/components/inline-custom-fields";

export function AccountDetailsPage() {
  const { accountId } = useParams();
  const { data, isLoading, error } = useAccount(accountId);
  const addNote = useAddAccountNote();
  const updateAccount = useUpdateAccount();
  const { data: owners = [] } = useContactOwners();
  const [note, setNote] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState<{
    name: string;
    website: string;
    industry: string;
    phone: string;
    description: string;
    ownerId: string;
    tags: string;
    lifecycleStage: string;
    customFields: Record<string, unknown>;
  }>({
    name: "",
    website: "",
    industry: "",
    phone: "",
    description: "",
    ownerId: "",
    tags: "",
    lifecycleStage: "prospect",
    customFields: {},
  });

  if (isLoading)
    return (
      <div className="flex justify-center py-20">
        <Loader size="lg" />
      </div>
    );
  if (error || !data)
    return (
      <div className="rounded-lg border border-destructive/30 p-6 text-destructive">
        {error?.message || "Company not found"}
      </div>
    );
  const { account, contacts, opportunities, activity } = data;

  const submitNote = async (event: FormEvent) => {
    event.preventDefault();
    if (!accountId || !note.trim()) return;
    try {
      await addNote.mutateAsync({ id: accountId, content: note });
      setNote("");
      toast.success("Note added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add note");
    }
  };
  const openEditor = () => {
    setEdit({
      name: account.name,
      website: account.website,
      industry: account.industry,
      phone: account.phone,
      description: account.description,
      ownerId: account.owner?.id || "",
      tags: account.tags.join(", "),
      lifecycleStage: account.lifecycleStage,
      customFields: account.customFields || {},
    });
    setEditOpen(true);
  };
  const submitEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!accountId) return;
    try {
      await updateAccount.mutateAsync({
        id: accountId,
        payload: {
          ...edit,
          ownerId: edit.ownerId || null,
          tags: edit.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          lifecycleStage: edit.lifecycleStage as typeof account.lifecycleStage,
        },
      });
      setEditOpen(false);
      toast.success("Company updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update company",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{account.name}</h1>
              <Badge variant="outline" className="capitalize">
                {account.lifecycleStage}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {account.industry || "Industry not specified"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openEditor}>
            Edit company
          </Button>
          {account.website && (
            <Button asChild variant="outline">
              <a href={account.website} target="_blank" rel="noreferrer">
                Website <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Owner</CardTitle>
          </CardHeader>
          <CardContent>{account.owner?.name || "Unassigned"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Contacts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {contacts.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Open CRM value</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {opportunities
              .reduce((sum, item) => sum + item.value, 0)
              .toLocaleString()}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Industry
            </p>
            <p className="mt-1">{account.industry || "Not specified"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Phone
            </p>
            <p className="mt-1">{account.phone || "Not specified"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tags
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {account.tags.length ? (
                account.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))
              ) : (
                <span>None</span>
              )}
            </div>
          </div>
          <div className="md:col-span-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              About
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm">
              {account.description || "No company description yet."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Additional information</CardTitle>
        </CardHeader>
        <CardContent>
          <InlineCustomFields
            entityType="accounts"
            values={account.customFields || {}}
            onChange={() => undefined}
            readOnly
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contacts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contacts.length ? (
                contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <UserRound className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{contact.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {contact.email ||
                            contact.phone ||
                            "No contact information"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {contact.email && (
                        <a href={`mailto:${contact.email}`}>
                          <Mail className="h-4 w-4" />
                        </a>
                      )}
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`}>
                          <Phone className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No contacts linked yet.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Opportunities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {opportunities.length ? (
                opportunities.map((opportunity) => (
                  <Link
                    key={opportunity.id}
                    to={`/dashboard/crm/pipeline/${opportunity.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30"
                  >
                    <div>
                      <p className="font-medium">{opportunity.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {opportunity.primaryContact?.name ||
                          "No primary contact"}{" "}
                        · {opportunity.stage}
                      </p>
                    </div>
                    <p className="font-semibold">
                      {opportunity.currency}{" "}
                      {opportunity.value.toLocaleString()}
                    </p>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No opportunities linked yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Activity and notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={submitNote} className="flex gap-2">
              <Input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add a company note…"
              />
              <Button
                type="submit"
                disabled={!note.trim() || addNote.isPending}
              >
                Add
              </Button>
            </form>
            <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-2">
              {activity.length ? (
                activity.map((item) => (
                  <div
                    key={item.id}
                    className="border-l-2 border-primary/30 pl-3"
                  >
                    <p className="text-sm">{item.content}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.actor ||
                        item.contact?.name ||
                        item.opportunity?.title ||
                        item.type}{" "}
                      · {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No activity yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit company</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <InlineCustomFields
              entityType="accounts"
              values={edit.customFields}
              onChange={(customFields) => setEdit({ ...edit, customFields })}
              disabled={updateAccount.isPending}
              systemFields={{
                name: (field) => (
                  <div className="grid gap-2">
                    <Label>
                      {field.label}
                      {field.required ? " *" : ""}
                    </Label>
                    <Input
                      required={field.required}
                      value={edit.name}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        setEdit({ ...edit, name: event.target.value })
                      }
                    />
                  </div>
                ),
                website: (field) => (
                  <div className="grid gap-2">
                    <Label>{field.label}</Label>
                    <Input
                      type="url"
                      value={edit.website}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        setEdit({ ...edit, website: event.target.value })
                      }
                    />
                  </div>
                ),
                industry: (field) => (
                  <div className="grid gap-2">
                    <Label>{field.label}</Label>
                    <Input
                      value={edit.industry}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        setEdit({ ...edit, industry: event.target.value })
                      }
                    />
                  </div>
                ),
                phone: (field) => (
                  <div className="grid gap-2">
                    <Label>{field.label}</Label>
                    <Input
                      value={edit.phone}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        setEdit({ ...edit, phone: event.target.value })
                      }
                    />
                  </div>
                ),
                ownerId: (field) => (
                  <div className="grid gap-2">
                    <Label>{field.label}</Label>
                    <select
                      value={edit.ownerId}
                      onChange={(event) =>
                        setEdit({ ...edit, ownerId: event.target.value })
                      }
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Unassigned</option>
                      {owners.map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ),
                lifecycleStage: (field) => (
                  <div className="grid gap-2">
                    <Label>{field.label}</Label>
                    <select
                      value={edit.lifecycleStage}
                      onChange={(event) =>
                        setEdit({ ...edit, lifecycleStage: event.target.value })
                      }
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {[
                        "prospect",
                        "qualified",
                        "customer",
                        "inactive",
                        "lost",
                      ].map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </div>
                ),
                tags: (field) => (
                  <div className="grid gap-2">
                    <Label>{field.label}</Label>
                    <Input
                      value={edit.tags}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        setEdit({ ...edit, tags: event.target.value })
                      }
                    />
                  </div>
                ),
                description: (field) => (
                  <div className="grid gap-2">
                    <Label>{field.label}</Label>
                    <Textarea
                      value={edit.description}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        setEdit({ ...edit, description: event.target.value })
                      }
                    />
                  </div>
                ),
              }}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateAccount.isPending}>
                {updateAccount.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
