export const INTERNAL_ACCESS_LEVELS = [
  { value: "full" as const, label: "Full access" },
  { value: "read_only" as const, label: "Read only access" },
] as const

export type InternalAccessLevel =
  (typeof INTERNAL_ACCESS_LEVELS)[number]["value"]

export function parseInternalAccessLevel(
  raw: string | null | undefined
): InternalAccessLevel {
  if (raw === "read_only") return "read_only"
  return "full"
}

export function isReadOnlyAccessLevel(
  accessLevel: string | null | undefined
): boolean {
  return parseInternalAccessLevel(accessLevel) === "read_only"
}

export function isFullAccessLevel(
  accessLevel: string | null | undefined
): boolean {
  return parseInternalAccessLevel(accessLevel) === "full"
}

export function internalAccessLevelLabel(
  accessLevel: string | null | undefined
): string {
  const parsed = parseInternalAccessLevel(accessLevel)
  return (
    INTERNAL_ACCESS_LEVELS.find((item) => item.value === parsed)?.label ??
    "Full access"
  )
}
