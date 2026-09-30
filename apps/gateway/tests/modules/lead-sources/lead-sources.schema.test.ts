import { describe, expect, it } from "vitest";
import { leadSourcesSchema } from "@modules/lead-sources/lead-sources.schema";

describe("leadSourcesSchema.updateForm", () => {
  it("accepts supported system and custom-field mappings", () => {
    const result = leadSourcesSchema.updateForm.validate({
      fieldMappings: {
        full_name: "name",
        email: "email",
        product_interest: "customFields.product_interest",
        unused_answer: "ignore",
      },
      defaults: {
        tags: ["facebook-lead", "paid"],
        createOpportunity: true,
      },
    });

    expect(result.error).toBeUndefined();
  });

  it("rejects mappings to fields that ingestion cannot safely write", () => {
    const result = leadSourcesSchema.updateForm.validate({
      fieldMappings: { email: "organizationId" },
    });

    expect(result.error).toBeDefined();
  });
});

describe("leadSourcesSchema.listSubmissions", () => {
  it("rejects unsupported statuses", () => {
    const result = leadSourcesSchema.listSubmissions.validate({
      status: "deleted",
    });

    expect(result.error).toBeDefined();
  });
});
