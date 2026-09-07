export const LANDING_PAGE_SLUG_MAX = 80

export const RESERVED_DASHBOARD_SLUGS = new Set([
  "new-landing",
  "ops",
  "profile",
  "team",
])

export function landingPageSlugBase(name: string, fallbackId?: string): string {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LANDING_PAGE_SLUG_MAX)
    .replace(/-+$/g, "")

  if (!normalized) {
    const suffix = (fallbackId ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(-8)
    return suffix ? `landing-${suffix}` : "landing-page"
  }
  if (RESERVED_DASHBOARD_SLUGS.has(normalized)) {
    return `${normalized}-landing`
  }
  return normalized
}

export function landingPageSlugCandidate(
  name: string,
  sequence = 1,
  fallbackId?: string
): string {
  const base = landingPageSlugBase(name, fallbackId)
  if (sequence <= 1) return base
  const suffix = `-${sequence}`
  return `${base.slice(0, LANDING_PAGE_SLUG_MAX - suffix.length)}${suffix}`
}
