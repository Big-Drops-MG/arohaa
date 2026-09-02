export const DEFAULT_ROLE_OPTIONS = [
  "CEO",
  "CFO",
  "Web Developer",
  "UI/UX Designer",
  "Content Creater",
  "Business Development Manager (BDM)",
  "Graphics Designer",
] as const

export const CUSTOM_ROLE_VALUE = "__custom__"

export function normalizeRoleName(role: string): string {
  return role.trim().replace(/\s+/g, " ")
}

export function isValidRoleName(role: string): boolean {
  const normalized = normalizeRoleName(role)
  return normalized.length >= 2 && normalized.length <= 80
}
