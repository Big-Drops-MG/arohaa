export const DEFAULT_ROLE_OPTIONS = [
  "CEO",
  "Web Developer",
  "UI/UX Designer",
  "Content Creater",
  "Business Development Manager (BDM)",
  "Graphics Designer",
] as const

/** Select value that opens a custom role input. */
export const CUSTOM_ROLE_VALUE = "__custom__"

export const CEO_ROLE = "CEO" as const

export function isCeoRole(role: string | null | undefined): boolean {
  return role?.trim() === CEO_ROLE
}

export function normalizeRoleName(role: string): string {
  return role.trim().replace(/\s+/g, " ")
}

export function isValidRoleName(role: string): boolean {
  const normalized = normalizeRoleName(role)
  return normalized.length >= 2 && normalized.length <= 80
}
