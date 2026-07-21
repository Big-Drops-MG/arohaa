export type UtmFilterDimension = 'utm_source' | 'utm_s1'

/** Multi-select AND filters across UTM Source and UTM S1. */
export type AnalyticsUtmFilter = {
  utm_source?: string[]
  utm_s1?: string[]
}

const MAX_VALUE_LEN = 100
const MAX_VALUES_PER_DIMENSION = 50
const VALUE_SEPARATOR = ','

export function isUtmFilterDimension(
  value: string,
): value is UtmFilterDimension {
  return value === 'utm_source' || value === 'utm_s1'
}

function sanitizeUtmValue(value?: string | null): string | undefined {
  const trimmed = value?.trim().replaceAll(',', '')
  if (!trimmed || trimmed.length > MAX_VALUE_LEN) return undefined
  return trimmed
}

export function parseUtmValueList(
  raw?: string | string[] | null,
): string[] | undefined {
  if (raw == null) return undefined
  const parts = (Array.isArray(raw) ? raw.join(VALUE_SEPARATOR) : raw)
    .split(VALUE_SEPARATOR)
    .map((part) => sanitizeUtmValue(part))
    .filter((part): part is string => Boolean(part))

  const unique = [...new Set(parts)].slice(0, MAX_VALUES_PER_DIMENSION)
  return unique.length > 0 ? unique : undefined
}

export function hasAnalyticsUtmFilter(
  filter?: AnalyticsUtmFilter | null,
): boolean {
  return Boolean(filter?.utm_source?.length || filter?.utm_s1?.length)
}

export function normalizeAnalyticsUtmFilter(
  filter?: AnalyticsUtmFilter | null,
): AnalyticsUtmFilter | undefined {
  if (!filter) return undefined
  const next: AnalyticsUtmFilter = {}
  const source = parseUtmValueList(filter.utm_source)
  const s1 = parseUtmValueList(filter.utm_s1)
  if (source) next.utm_source = source
  if (s1) next.utm_s1 = s1
  return hasAnalyticsUtmFilter(next) ? next : undefined
}

/**
 * Prefer explicit `utm_source` / `utm_s1` (comma-separated multi values).
 * Falls back to legacy `utm_dim` + `utm_value`.
 */
export function parseAnalyticsUtmFilter(query: {
  utm_source?: string | string[] | null
  utm_s1?: string | string[] | null
  utm_medium?: string | string[] | null
  utm_dim?: string | null
  utm_value?: string | null
}): AnalyticsUtmFilter | undefined {
  const fromExplicit = normalizeAnalyticsUtmFilter({
    utm_source: parseUtmValueList(query.utm_source),
    utm_s1: parseUtmValueList(query.utm_s1),
  })
  if (fromExplicit) return fromExplicit

  const dim = query.utm_dim?.trim()
  const value = sanitizeUtmValue(query.utm_value)
  if (!dim || !value || !isUtmFilterDimension(dim)) return undefined
  return { [dim]: [value] }
}

export function utmFilterSql(filter?: AnalyticsUtmFilter): string {
  const normalized = normalizeAnalyticsUtmFilter(filter)
  if (!normalized) return ''
  const parts: string[] = []
  if (normalized.utm_source?.length) {
    parts.push('utm_source IN {utm_sources:Array(String)}')
  }
  if (normalized.utm_s1?.length) {
    parts.push('utm_s1 IN {utm_s1s:Array(String)}')
  }
  return parts.length ? ` AND ${parts.join(' AND ')}` : ''
}

export function utmFilterParams(
  filter?: AnalyticsUtmFilter,
): Record<string, string[]> {
  const normalized = normalizeAnalyticsUtmFilter(filter)
  if (!normalized) return {}
  const params: Record<string, string[]> = {}
  if (normalized.utm_source?.length) params.utm_sources = normalized.utm_source
  if (normalized.utm_s1?.length) params.utm_s1s = normalized.utm_s1
  return params
}

export function utmFilterCacheKey(filter?: AnalyticsUtmFilter): string {
  const normalized = normalizeAnalyticsUtmFilter(filter)
  if (!normalized) return 'all'
  return [
    normalized.utm_source?.length
      ? `utm_source:${[...normalized.utm_source].sort().join(',')}`
      : null,
    normalized.utm_s1?.length
      ? `utm_s1:${[...normalized.utm_s1].sort().join(',')}`
      : null,
  ]
    .filter(Boolean)
    .join('|')
}
