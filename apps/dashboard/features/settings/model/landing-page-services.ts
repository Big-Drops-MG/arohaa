import type { OverviewLandingFormType } from "@/features/overview/model/overview"

export type LandingPageService = {
  id: string
  label: string
  /** Linked vertical / service landing page public id, when configured. */
  targetPublicId: string | null
  /** Destination URL used for SDK href matching and display. */
  href: string | null
}

export type LandingPageServicesMetadata = {
  services?: LandingPageService[]
}

function slugifyServiceId(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return base || `service-${Math.random().toString(36).slice(2, 8)}`
}

export function parseLandingPageServices(
  metadata: Record<string, unknown> | null | undefined
): LandingPageService[] {
  const raw = metadata?.services
  if (!Array.isArray(raw)) return []

  const out: LandingPageService[] = []
  const seen = new Set<string>()

  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const label = typeof row.label === "string" ? row.label.trim() : ""
    if (!label) continue

    let id =
      typeof row.id === "string" && row.id.trim()
        ? row.id.trim()
        : slugifyServiceId(label)
    if (seen.has(id)) {
      id = `${id}-${out.length + 1}`
    }
    seen.add(id)

    const targetPublicId =
      typeof row.targetPublicId === "string" && row.targetPublicId.trim()
        ? row.targetPublicId.trim()
        : null
    const href =
      typeof row.href === "string" && row.href.trim() ? row.href.trim() : null

    out.push({ id, label, targetPublicId, href })
  }

  return out
}

export function normalizeLandingPageServicesInput(
  raw: unknown
): { ok: true; value: LandingPageService[] } | { ok: false; error: string } {
  if (raw === undefined) {
    return { ok: false, error: "services field missing" }
  }
  if (!Array.isArray(raw)) {
    return { ok: false, error: "services must be an array" }
  }
  if (raw.length > 50) {
    return { ok: false, error: "At most 50 services allowed" }
  }

  const out: LandingPageService[] = []
  const seen = new Set<string>()

  for (const item of raw) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Invalid service entry" }
    }
    const row = item as Record<string, unknown>
    const label = typeof row.label === "string" ? row.label.trim() : ""
    if (!label) {
      return { ok: false, error: "Each service needs a label" }
    }
    if (label.length > 120) {
      return { ok: false, error: "Service label is too long" }
    }

    const id =
      typeof row.id === "string" && row.id.trim()
        ? row.id.trim().slice(0, 80)
        : slugifyServiceId(label)
    if (seen.has(id)) {
      return { ok: false, error: `Duplicate service id: ${id}` }
    }
    seen.add(id)

    let href: string | null = null
    if (
      row.href !== undefined &&
      row.href !== null &&
      String(row.href).trim()
    ) {
      const hrefRaw = String(row.href).trim()
      try {
        const u = new URL(hrefRaw)
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          return { ok: false, error: "Service URL must use http or https" }
        }
        href = hrefRaw
      } catch {
        return { ok: false, error: "Invalid service URL" }
      }
    }

    const targetPublicId =
      typeof row.targetPublicId === "string" && row.targetPublicId.trim()
        ? row.targetPublicId.trim()
        : null

    out.push({ id, label, targetPublicId, href })
  }

  return { ok: true, value: out }
}

export function mergeServicesIntoMetadata(
  existing: Record<string, unknown> | null | undefined,
  services: LandingPageService[]
): Record<string, unknown> {
  const base = { ...(existing ?? {}) }
  if (services.length === 0) {
    delete base.services
  } else {
    base.services = services
  }
  return base
}

export function isHubLandingPage(formType: OverviewLandingFormType): boolean {
  return formType === "none"
}

/** Compact payload embedded in the SDK snippet for href matching. */
export function servicesForSdkSnippet(
  services: LandingPageService[]
): Array<{ id: string; label: string; href?: string }> {
  return services.map((s) => ({
    id: s.id,
    label: s.label,
    ...(s.href ? { href: s.href } : {}),
  }))
}
