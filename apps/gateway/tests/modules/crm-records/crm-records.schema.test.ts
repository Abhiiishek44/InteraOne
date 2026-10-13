import { describe, expect, it } from "vitest";
import { crmRecordsSchema } from "../../../src/modules/crm-records/crm-records.schema";
import { dealsSchema } from "../../../src/modules/deals/deals.schema";
import { leadsSchema } from "../../../src/modules/leads/leads.schema";

describe("CRM record schemas", () => {
  it("accepts a complete CRM record", () => {
    const { error } = crmRecordsSchema.create.validate({
      contactId: "507f1f77bcf86cd799439011",
      title: "Enterprise expansion",
      value: 50000,
      currency: "INR",
      stage: "proposal",
      expectedCloseAt: "2026-10-15T00:00:00.000Z",
      nextAction: "Send final proposal",
    });

    expect(error).toBeUndefined();
  });

  it("accepts custom stage identifiers and rejects malformed stages", () => {
    expect(
      crmRecordsSchema.create.validate({
        contactId: "507f1f77bcf86cd799439011",
        title: "Invalid deal",
        value: -1,
      }).error,
    ).toBeDefined();
    expect(
      crmRecordsSchema.updateStage.validate({ stage: "Not a valid stage!" })
        .error,
    ).toBeDefined();
    expect(
      crmRecordsSchema.updateStage.validate({ stage: "legal-review" }).error,
    ).toBeUndefined();
    expect(
      crmRecordsSchema.updateColor.validate({ color: "pink" }).error,
    ).toBeUndefined();
    expect(
      crmRecordsSchema.updateColor.validate({ color: "transparent" }).error,
    ).toBeDefined();
  });

  it("validates customizable pipeline stages", () => {
    const valid = crmRecordsSchema.updatePipeline.validate({
      name: "Enterprise sales",
      stages: [
        { id: "lead", label: "Lead", color: "blue", type: "open", order: 0 },
        {
          id: "closed-won",
          label: "Won",
          color: "emerald",
          type: "won",
          order: 1,
        },
        {
          id: "closed-lost",
          label: "Lost",
          color: "rose",
          type: "lost",
          order: 2,
        },
      ],
    });
    expect(valid.error).toBeUndefined();

    const missingOutcome = crmRecordsSchema.updatePipeline.validate({
      name: "Broken pipeline",
      stages: [
        { id: "lead", label: "Lead", color: "blue", type: "open", order: 0 },
        {
          id: "review",
          label: "Review",
          color: "amber",
          type: "open",
          order: 1,
        },
        {
          id: "closed",
          label: "Closed",
          color: "rose",
          type: "lost",
          order: 2,
        },
      ],
    });
    expect(missingOutcome.error).toBeDefined();
  });

  it("keeps lead and deal creation scoped to their route", () => {
    const payload = {
      accountId: "507f1f77bcf86cd799439011",
      title: "New CRM record",
    };

    expect(dealsSchema.create.validate(payload).error).toBeUndefined();
    expect(leadsSchema.create.validate(payload).error).toBeUndefined();
    expect(
      dealsSchema.create.validate({ ...payload, recordType: "lead" }).error,
    ).toBeDefined();
    expect(
      leadsSchema.create.validate({ ...payload, recordType: "deal" }).error,
    ).toBeDefined();
  });
});
