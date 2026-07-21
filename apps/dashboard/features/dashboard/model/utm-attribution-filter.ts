export type UtmFilterDimension = "utm_source" | "utm_s1"

/** Multi-select AND filters across UTM Source and UTM S1. */
export type DashboardUtmFilter = {
  utm_source?: string[]
  utm_s1?: string[]
}

export const UTM_FILTER_DIMENSIONS: readonly UtmFilterDimension[] = [
  "utm_source",
  "utm_s1",
] as const

export const UTM_FILTER_DIMENSION_OPTIONS: {
  id: UtmFilterDimension
  label: string
}[] = [
  { id: "utm_source", label: "UTM Source" },
  { id: "utm_s1", label: "UTM S1" },
]

const MAX_VALUE_LEN = 100
const MAX_VALUES_PER_DIMENSION = 50
const VALUE_SEPARATOR = ","

export function isUtmFilterDimension(
  value: string | null | undefined
): value is UtmFilterDimension {
  return value === "utm_source" || value === "utm_s1"
}

function sanitizeUtmValue(value?: string | null): string | undefined {
  const trimmed = value?.trim().replaceAll(",", "")
  if (!trimmed || trimmed.length > MAX_VALUE_LEN) return undefined
  return trimmed
}

export function parseUtmValueList(
  raw?: string | string[] | null
): string[] | undefined {
  if (raw == null) return undefined
  const parts = (Array.isArray(raw) ? raw.join(VALUE_SEPARATOR) : raw)
    .split(VALUE_SEPARATOR)
    .map((part) => sanitizeUtmValue(part))
    .filter((part): part is string => Boolean(part))

  const unique = [...new Set(parts)].slice(0, MAX_VALUES_PER_DIMENSION)
  return unique.length > 0 ? unique : undefined
}

export function serializeUtmValueList(
  values?: string[] | null
): string | undefined {
  const parsed = parseUtmValueList(values ?? null)
  return parsed?.join(VALUE_SEPARATOR)
}

export function hasDashboardUtmFilter(
  filter?: DashboardUtmFilter | null
): boolean {
  return Boolean(filter?.utm_source?.length || filter?.utm_s1?.length)
}

export function normalizeDashboardUtmFilter(
  filter?: DashboardUtmFilter | null
): DashboardUtmFilter | undefined {
  if (!filter) return undefined
  const next: DashboardUtmFilter = {}
  const source = parseUtmValueList(filter.utm_source)
  const s1 = parseUtmValueList(filter.utm_s1)
  if (source) next.utm_source = source
  if (s1) next.utm_s1 = s1
  return hasDashboardUtmFilter(next) ? next : undefined
}

/**
 * Prefer explicit `utm_source` / `utm_s1` (comma-separated multi values).
 * Falls back to legacy `utm_dim` + `utm_value`.
 */
export function parseDashboardUtmFilterFromParams(params: {
  utm_source?: string | string[] | null
  utm_s1?: string | string[] | null
  utm_medium?: string | string[] | null
  utm_dim?: string | null
  utm_value?: string | null
}): DashboardUtmFilter | undefined {
  const fromExplicit = normalizeDashboardUtmFilter({
    utm_source: parseUtmValueList(params.utm_source),
    utm_s1: parseUtmValueList(params.utm_s1),
  })
  if (fromExplicit) return fromExplicit

  const dim = params.utm_dim?.trim()
  const value = sanitizeUtmValue(params.utm_value)
  if (!dim || !value || !isUtmFilterDimension(dim)) return undefined
  return { [dim]: [value] }
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
  return dimension === "utm_source" ? "UTM Source" : "UTM S1"
}

function formatDimensionSelection(
  shortLabel: string,
  values: string[]
): string {
  if (values.length === 1) return `${shortLabel}: ${values[0]}`
  if (values.length === 2) return `${shortLabel}: ${values[0]}, ${values[1]}`
  return `${shortLabel}: ${values[0]} +${values.length - 1}`
}

export function formatDashboardUtmFilterLabel(
  filter?: DashboardUtmFilter | null
): string {
  const normalized = normalizeDashboardUtmFilter(filter)
  if (!normalized) return "All traffic"

  const parts: string[] = []
  if (normalized.utm_source?.length) {
    parts.push(formatDimensionSelection("Source", normalized.utm_source))
  }
  if (normalized.utm_s1?.length) {
    parts.push(formatDimensionSelection("S1", normalized.utm_s1))
  }
  return parts.join(" · ")
}

export function utmFilterCacheKey(filter?: DashboardUtmFilter | null): string {
  const normalized = normalizeDashboardUtmFilter(filter)
  if (!normalized) return "all"
  return [
    normalized.utm_source?.length
      ? `utm_source:${[...normalized.utm_source].sort().join(",")}`
      : null,
    normalized.utm_s1?.length
      ? `utm_s1:${[...normalized.utm_s1].sort().join(",")}`
      : null,
  ]
    .filter(Boolean)
    .join("|")
}

export function isDimensionValueSelected(
  filter: DashboardUtmFilter | null | undefined,
  dimension: UtmFilterDimension,
  value: string
): boolean {
  return Boolean(filter?.[dimension]?.includes(value))
}

export function toggleDimensionValueInFilter(
  filter: DashboardUtmFilter | null | undefined,
  dimension: UtmFilterDimension,
  value: string
): DashboardUtmFilter | undefined {
  const current = normalizeDashboardUtmFilter(filter) ?? {}
  const existing = current[dimension] ?? []
  const nextValues = existing.includes(value)
    ? existing.filter((item) => item !== value)
    : [...existing, value]
  const next: DashboardUtmFilter = {
    ...current,
    [dimension]: nextValues.length > 0 ? nextValues : undefined,
  }
  return normalizeDashboardUtmFilter(next)
}
