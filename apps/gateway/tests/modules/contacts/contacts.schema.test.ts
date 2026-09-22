import { describe, expect, it } from "vitest";
import { contactsSchema } from "../../../src/modules/contacts/contacts.schema";

describe("contactsSchema CRM fields", () => {
  it("accepts a persisted manual contact with CRM metadata", () => {
    const { error, value } = contactsSchema.createContact.validate({
      name: "Priya Sharma",
      email: "priya@example.com",
      lifecycleStage: "qualified",
      leadStatus: "follow_up",
      acquisitionSource: "whatsapp",
      preferredChannel: "whatsapp",
      nextFollowUpAt: "2026-09-21T10:00:00.000Z",
    });

    expect(error).toBeUndefined();
    expect(value.lifecycleStage).toBe("qualified");
    expect(value.leadStatus).toBe("follow_up");
  });

  it("rejects unsupported lifecycle and lead values", () => {
    const lifecycle = contactsSchema.updateContact.validate({
      lifecycleStage: "prospect",
    });
    const lead = contactsSchema.updateContact.validate({
      leadStatus: "waiting_forever",
    });

    expect(lifecycle.error).toBeDefined();
    expect(lead.error).toBeDefined();
  });

  it("supports clearing owner, preferred channel, and follow-up", () => {
    const { error } = contactsSchema.updateContact.validate({
      ownerId: null,
      preferredChannel: null,
      nextFollowUpAt: null,
    });

    expect(error).toBeUndefined();
  });

  it("accepts CRM list filters", () => {
    const { error } = contactsSchema.listContactsQuery.validate({
      lifecycleStage: "customer",
      leadStatus: "converted",
      followUp: "overdue",
    });

    expect(error).toBeUndefined();
  });
});
