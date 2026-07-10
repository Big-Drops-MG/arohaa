export type BlockedUtmLists = {
  utm_source: string[]
  utm_s1: string[]
}

export type BlockedUtmSets = {
  utm_source: Set<string>
  utm_s1: Set<string>
}

export const DEFAULT_UTM_DENIED_PATH = "/access-denied"

export function normalizeDeniedPath(raw: string | null | undefined): string {
  const path = raw?.trim() || DEFAULT_UTM_DENIED_PATH
  if (!path.startsWith("/") || path.startsWith("//")) {
    return DEFAULT_UTM_DENIED_PATH
  }
  return path
}

export function isAccessDeniedPath(
  pathname: string,
  deniedPath: string,
): boolean {
  const normalizedDenied = normalizeDeniedPath(deniedPath)
  if (pathname === normalizedDenied) return true
  return pathname.startsWith(`${normalizedDenied}/`)
}

function sanitizeUtmParamValue(
  key: "utm_source" | "utm_s1",
  value: string,
): string {
  const trimmed = value.trim()
  if (!trimmed) return ""

  const delimiterIndex = trimmed.search(/[&?#]/)
  const candidate = (
    delimiterIndex === -1 ? trimmed : trimmed.slice(0, delimiterIndex)
  ).trim()
  if (!candidate) return ""

  if (/\butm_[a-z0-9_]+=/i.test(candidate)) return ""
  if (key === "utm_source" && candidate.includes("=")) return ""

  return candidate
}

export function toBlockedUtmSets(lists: BlockedUtmLists): BlockedUtmSets {
  return {
    utm_source: new Set(lists.utm_source),
    utm_s1: new Set(lists.utm_s1),
  }
}

export function emptyBlockedUtmSets(): BlockedUtmSets {
  return { utm_source: new Set<string>(), utm_s1: new Set<string>() }
}

export function isUtmBlocked(
  sets: BlockedUtmSets,
  utmSource: string | undefined,
  utmS1: string | undefined,
): boolean {
  if (sets.utm_source.size > 0) {
    const source = sanitizeUtmParamValue("utm_source", utmSource ?? "")
    if (source && sets.utm_source.has(source)) return true
  }
  if (sets.utm_s1.size > 0) {
    const s1 = sanitizeUtmParamValue("utm_s1", utmS1 ?? "")
    if (s1 && sets.utm_s1.has(s1)) return true
  }
  return false
}
