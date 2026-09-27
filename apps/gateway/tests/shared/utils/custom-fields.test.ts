import { describe, expect, it } from "vitest";
import { serializeCustomFields } from "../../../src/shared/utils/custom-fields";

describe("serializeCustomFields", () => {
  it("flattens Mongoose-style maps for API responses", () => {
    expect(
      serializeCustomFields(
        new Map([
          ["custom_company_size", 250],
          ["custom_location", "Pune"],
        ]),
      ),
    ).toEqual({ custom_company_size: 250, custom_location: "Pune" });
  });

  it("preserves plain objects and normalizes empty values", () => {
    expect(serializeCustomFields({ custom_location: "Mumbai" })).toEqual({
      custom_location: "Mumbai",
    });
    expect(serializeCustomFields(undefined)).toEqual({});
  });
});
