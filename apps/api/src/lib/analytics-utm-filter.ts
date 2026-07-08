export type UtmFilterDimension = 'utm_source' | 'utm_medium'

export type AnalyticsUtmFilter = {
  dimension: UtmFilterDimension
  value: string
}

export function isUtmFilterDimension(
  value: string,
): value is UtmFilterDimension {
  return value === 'utm_source' || value === 'utm_medium'
}

export function parseAnalyticsUtmFilter(
  dimension?: string | null,
  value?: string | null,
): AnalyticsUtmFilter | undefined {
  const dim = dimension?.trim()
  const val = value?.trim()
  if (!dim || !val || !isUtmFilterDimension(dim)) return undefined
  if (val.length > 100) return undefined
  return { dimension: dim, value: val }
}

export function utmFilterSql(filter?: AnalyticsUtmFilter): string {
  if (!filter) return ''
  return ` AND ${filter.dimension} = {utm_value:String}`
}

export function utmFilterParams(
  filter?: AnalyticsUtmFilter,
): Record<string, string> {
  if (!filter?.value) return {}
  return { utm_value: filter.value }
}

export function utmFilterCacheKey(filter?: AnalyticsUtmFilter): string {
  if (!filter) return 'all'
  return `${filter.dimension}:${filter.value}`
}
