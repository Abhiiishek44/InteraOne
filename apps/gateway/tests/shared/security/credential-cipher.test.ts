import { describe, expect, it, vi } from "vitest";

vi.mock("@shared/infra/config", () => ({
  default: {
    leadSources: { encryptionKey: "test-only-lead-source-key" },
  },
}));

import {
  decryptCredential,
  encryptCredential,
} from "@shared/security/credential-cipher";

describe("credential cipher", () => {
  it("round-trips provider credentials without storing plaintext", () => {
    const token = "EAAB-secret-page-token";
    const encrypted = encryptCredential(token);

    expect(encrypted).not.toContain(token);
    expect(decryptCredential(encrypted)).toBe(token);
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptCredential("secret");
    const replacement = encrypted.endsWith("A") ? "B" : "A";
    const tampered = `${encrypted.slice(0, -1)}${replacement}`;

    expect(() => decryptCredential(tampered)).toThrow();
  });
});
