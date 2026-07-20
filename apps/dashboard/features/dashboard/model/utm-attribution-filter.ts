export type UtmFilterDimension = "utm_source" | "utm_medium"

/** Optional AND filters across UTM dimensions. */
export type DashboardUtmFilter = {
  utm_source?: string
  utm_medium?: string
}

export const UTM_FILTER_DIMENSIONS: readonly UtmFilterDimension[] = [
  "utm_source",
  "utm_medium",
] as const

export const UTM_FILTER_DIMENSION_OPTIONS: {
  id: UtmFilterDimension
  label: string
}[] = [
  { id: "utm_source", label: "UTM Source" },
  { id: "utm_medium", label: "UTM Medium" },
]

const MAX_VALUE_LEN = 100

export function isUtmFilterDimension(
  value: string | null | undefined
): value is UtmFilterDimension {
  return value === "utm_source" || value === "utm_medium"
}

function sanitizeUtmValue(value?: string | null): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed || trimmed.length > MAX_VALUE_LEN) return undefined
  return trimmed
}

export function hasDashboardUtmFilter(
  filter?: DashboardUtmFilter | null
): boolean {
  return Boolean(filter?.utm_source || filter?.utm_medium)
}

export function normalizeDashboardUtmFilter(
  filter?: DashboardUtmFilter | null
): DashboardUtmFilter | undefined {
  if (!filter) return undefined
  const next: DashboardUtmFilter = {}
  const source = sanitizeUtmValue(filter.utm_source)
  const medium = sanitizeUtmValue(filter.utm_medium)
  if (source) next.utm_source = source
  if (medium) next.utm_medium = medium
  return hasDashboardUtmFilter(next) ? next : undefined
}

/**
 * Prefer explicit `utm_source` / `utm_medium` query params.
 * Falls back to legacy `utm_dim` + `utm_value`.
 */
export function parseDashboardUtmFilterFromParams(params: {
  utm_source?: string | null
  utm_medium?: string | null
  utm_dim?: string | null
  utm_value?: string | null
}): DashboardUtmFilter | undefined {
  const fromExplicit = normalizeDashboardUtmFilter({
    utm_source: params.utm_source ?? undefined,
    utm_medium: params.utm_medium ?? undefined,
  })
  if (fromExplicit) return fromExplicit

  const dim = params.utm_dim?.trim()
  const value = sanitizeUtmValue(params.utm_value)
  if (!dim || !value || !isUtmFilterDimension(dim)) return undefined
  return { [dim]: value }
}

/** @deprecated Prefer parseDashboardUtmFilterFromParams */
export function parseDashboardUtmFilter(
  dimension?: string | null,
  value?: string | null
): DashboardUtmFilter | undefined {
  return parseDashboardUtmFilterFromParams({
    utm_dim: dimension,
    utm_value: value,
  })
}

export function utmFilterDimensionLabel(dimension: UtmFilterDimension): string {
  return dimension === "utm_source" ? "UTM Source" : "UTM Medium"
}

export function formatDashboardUtmFilterLabel(
  filter?: DashboardUtmFilter | null
): string {
  const normalized = normalizeDashboardUtmFilter(filter)
  if (!normalized) return "All traffic"

  const parts: string[] = []
  if (normalized.utm_source) parts.push(`Source: ${normalized.utm_source}`)
  if (normalized.utm_medium) parts.push(`Medium: ${normalized.utm_medium}`)
  return parts.join(" · ")
}

export function utmFilterCacheKey(filter?: DashboardUtmFilter | null): string {
  const normalized = normalizeDashboardUtmFilter(filter)
  if (!normalized) return "all"
  return [
    normalized.utm_source ? `utm_source:${normalized.utm_source}` : null,
    normalized.utm_medium ? `utm_medium:${normalized.utm_medium}` : null,
  ]
    .filter(Boolean)
    .join("|")
}
