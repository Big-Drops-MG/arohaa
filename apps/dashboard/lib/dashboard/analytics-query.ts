import type { DashboardUtmFilter } from "@/features/dashboard/model/utm-attribution-filter"

export function buildAnalyticsApiPath(
  path: string,
  params: {
    rangeId?: string
    utmFilter?: DashboardUtmFilter | null
    extra?: Record<string, string>
  }
): string {
  const url = new URL(path, "http://localhost")
  if (params.rangeId) {
    url.searchParams.set("range_id", params.rangeId)
  }
  if (params.utmFilter?.dimension && params.utmFilter.value) {
    url.searchParams.set("utm_dim", params.utmFilter.dimension)
    url.searchParams.set("utm_value", params.utmFilter.value)
  }
  if (params.extra) {
    for (const [key, value] of Object.entries(params.extra)) {
      url.searchParams.set(key, value)
    }
  }
  return `${url.pathname}${url.search}`
}

export function shouldUseInitialTabData(
  dateRangeId: string,
  defaultDateRangeId: string,
  utmFilter?: DashboardUtmFilter | null
): boolean {
  return !utmFilter && dateRangeId === defaultDateRangeId
}
