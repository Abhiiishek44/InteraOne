export function serializeCustomFields(
  value: Map<string, unknown> | Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value.entries());
  return { ...value };
}
