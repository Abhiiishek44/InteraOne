import { useState, type FormEvent } from "react";
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
import { useCreateOpportunity } from "../hooks/use-opportunities";
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
  contacts: ContactListItem[];
  owners: ContactOwner[];
}

const emptyForm: CreateOpportunityPayload = {
  contactId: "",
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
  contacts,
  owners,
}: OpportunityDialogProps) {
  const createOpportunity = useCreateOpportunity();
  const [form, setForm] = useState<CreateOpportunityPayload>(() => {
    const firstOpen = stages.find((stage) => stage.type === "open");
    return {
      ...emptyForm,
      stage: initialStage || firstOpen?.id || stages[0]?.id || "",
    };
  });

  const selectContact = (contactId: string) => {
    const contact = contacts.find((item) => item.id === contactId);
    setForm((current) => ({
      ...current,
      contactId,
      company: contact?.company || current.company,
      title: current.title || (contact ? `${contact.name} opportunity` : ""),
      ownerId: contact?.owner?.id || current.ownerId,
    }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await createOpportunity.mutateAsync({
        ...form,
        expectedCloseAt: form.expectedCloseAt
          ? new Date(form.expectedCloseAt).toISOString()
          : null,
      });
      toast.success("Opportunity created");
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create opportunity",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create opportunity</DialogTitle>
          <DialogDescription>
            Connect a sales opportunity to an existing CRM contact.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="opportunity-contact">Contact</Label>
              <select
                id="opportunity-contact"
                required
                value={form.contactId}
                onChange={(event) => selectContact(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select contact</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name}
                  </option>
                ))}
              </select>
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
                <option value="">Use contact owner</option>
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
                !form.contactId ||
                !form.title.trim() ||
                !form.stage
              }
            >
              {createOpportunity.isPending ? "Creating…" : "Create opportunity"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
