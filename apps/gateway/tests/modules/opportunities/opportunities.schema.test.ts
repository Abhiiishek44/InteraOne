import { describe, expect, it } from "vitest";
import { opportunitiesSchema } from "../../../src/modules/opportunities/opportunities.schema";

describe("opportunitiesSchema", () => {
  it("accepts a complete opportunity", () => {
    const { error } = opportunitiesSchema.create.validate({
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
      opportunitiesSchema.create.validate({
        contactId: "507f1f77bcf86cd799439011",
        title: "Invalid deal",
        value: -1,
      }).error,
    ).toBeDefined();
    expect(
      opportunitiesSchema.updateStage.validate({ stage: "Not a valid stage!" })
        .error,
    ).toBeDefined();
    expect(
      opportunitiesSchema.updateStage.validate({ stage: "legal-review" }).error,
    ).toBeUndefined();
    expect(
      opportunitiesSchema.updateColor.validate({ color: "pink" }).error,
    ).toBeUndefined();
    expect(
      opportunitiesSchema.updateColor.validate({ color: "transparent" }).error,
    ).toBeDefined();
  });

  it("validates customizable pipeline stages", () => {
    const valid = opportunitiesSchema.updatePipeline.validate({
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

    const missingOutcome = opportunitiesSchema.updatePipeline.validate({
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
});
