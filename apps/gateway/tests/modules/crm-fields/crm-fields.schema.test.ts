import { describe, expect, it } from "vitest";
import { crmFieldsSchema } from "../../../src/modules/crm-fields/crm-fields.schema";

describe("CRM fields validation", () => {
  it("accepts a selectable contact field", () => {
    const result = crmFieldsSchema.create.validate({
      entityType: "contacts",
      label: "Customer tier",
      type: "single_select",
      options: [{ label: "Enterprise" }, { label: "Startup" }],
    });
    expect(result.error).toBeUndefined();
    expect(result.value.required).toBe(false);
  });

  it("rejects unsupported entities and field types", () => {
    expect(
      crmFieldsSchema.create.validate({
        entityType: "tickets",
        label: "Region",
        type: "relationship",
      }).error,
    ).toBeDefined();
  });

  it("supports activity popup fields and visual properties", () => {
    const result = crmFieldsSchema.create.validate({
      entityType: "activities",
      label: "Meeting URL",
      type: "text",
      visible: true,
      defaultValue: "https://example.com/meeting",
    });
    expect(result.error).toBeUndefined();
  });

  it.each(["file", "image", "signature"])(
    "accepts the %s uploaded asset field type",
    (type) => {
      const result = crmFieldsSchema.create.validate({
        entityType: "opportunities",
        label: `${type} field`,
        type,
      });
      expect(result.error).toBeUndefined();
    },
  );

  it("requires every field id when reordering", () => {
    const result = crmFieldsSchema.reorder.validate({
      entityType: "accounts",
      fieldIds: ["not-an-object-id"],
    });
    expect(result.error).toBeDefined();
  });
});
