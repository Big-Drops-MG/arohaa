export type UtmFilterDimension = 'utm_source' | 'utm_medium'

/** Optional AND filters across UTM dimensions. */
export type AnalyticsUtmFilter = {
  utm_source?: string
  utm_medium?: string
}

const MAX_VALUE_LEN = 100

export function isUtmFilterDimension(
  value: string,
): value is UtmFilterDimension {
  return value === 'utm_source' || value === 'utm_medium'
}

function sanitizeUtmValue(value?: string | null): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed || trimmed.length > MAX_VALUE_LEN) return undefined
  return trimmed
}

export function hasAnalyticsUtmFilter(
  filter?: AnalyticsUtmFilter | null,
): boolean {
  return Boolean(filter?.utm_source || filter?.utm_medium)
}

export function normalizeAnalyticsUtmFilter(
  filter?: AnalyticsUtmFilter | null,
): AnalyticsUtmFilter | undefined {
  if (!filter) return undefined
  const next: AnalyticsUtmFilter = {}
  const source = sanitizeUtmValue(filter.utm_source)
  const medium = sanitizeUtmValue(filter.utm_medium)
  if (source) next.utm_source = source
  if (medium) next.utm_medium = medium
  return hasAnalyticsUtmFilter(next) ? next : undefined
}

/**
 * Prefer explicit `utm_source` / `utm_medium` query params.
 * Falls back to legacy `utm_dim` + `utm_value`.
 */
export function parseAnalyticsUtmFilter(query: {
  utm_source?: string | null
  utm_medium?: string | null
  utm_dim?: string | null
  utm_value?: string | null
}): AnalyticsUtmFilter | undefined {
  const fromExplicit = normalizeAnalyticsUtmFilter({
    utm_source: query.utm_source ?? undefined,
    utm_medium: query.utm_medium ?? undefined,
  })
  if (fromExplicit) return fromExplicit

  const dim = query.utm_dim?.trim()
  const value = sanitizeUtmValue(query.utm_value)
  if (!dim || !value || !isUtmFilterDimension(dim)) return undefined
  return { [dim]: value }
}

export function utmFilterSql(filter?: AnalyticsUtmFilter): string {
  const normalized = normalizeAnalyticsUtmFilter(filter)
  if (!normalized) return ''
  const parts: string[] = []
  if (normalized.utm_source) {
    parts.push('utm_source = {utm_source:String}')
  }
  if (normalized.utm_medium) {
    parts.push('utm_medium = {utm_medium:String}')
  }
  return parts.length ? ` AND ${parts.join(' AND ')}` : ''
}

export function utmFilterParams(
  filter?: AnalyticsUtmFilter,
): Record<string, string> {
  const normalized = normalizeAnalyticsUtmFilter(filter)
  if (!normalized) return {}
  const params: Record<string, string> = {}
  if (normalized.utm_source) params.utm_source = normalized.utm_source
  if (normalized.utm_medium) params.utm_medium = normalized.utm_medium
  return params
}

export function utmFilterCacheKey(filter?: AnalyticsUtmFilter): string {
  const normalized = normalizeAnalyticsUtmFilter(filter)
  if (!normalized) return 'all'
  return [
    normalized.utm_source ? `utm_source:${normalized.utm_source}` : null,
    normalized.utm_medium ? `utm_medium:${normalized.utm_medium}` : null,
  ]
    .filter(Boolean)
    .join('|')
}
