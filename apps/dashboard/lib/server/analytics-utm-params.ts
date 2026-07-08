import type { DashboardUtmFilter } from "@/features/dashboard/model/utm-attribution-filter"
import { parseDashboardUtmFilter } from "@/features/dashboard/model/utm-attribution-filter"

export function appendDashboardUtmParams(
  url: URL,
  utmFilter?: DashboardUtmFilter
): void {
  if (!utmFilter?.dimension || !utmFilter.value) return
  url.searchParams.set("utm_dim", utmFilter.dimension)
  url.searchParams.set("utm_value", utmFilter.value)
}

export function parseUtmFilterFromSearchParams(
  searchParams: URLSearchParams
): DashboardUtmFilter | undefined {
  return parseDashboardUtmFilter(
    searchParams.get("utm_dim"),
    searchParams.get("utm_value")
  )
}

export function appendUtmFilterToQueryString(
  baseQuery: string,
  utmFilter?: DashboardUtmFilter
): string {
  if (!utmFilter?.dimension || !utmFilter.value) return baseQuery
  const params = new URLSearchParams(baseQuery.replace(/^\?/, ""))
  params.set("utm_dim", utmFilter.dimension)
  params.set("utm_value", utmFilter.value)
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}
