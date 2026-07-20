import type { DashboardUtmFilter } from "@/features/dashboard/model/utm-attribution-filter"
import {
  hasDashboardUtmFilter,
  normalizeDashboardUtmFilter,
  parseDashboardUtmFilterFromParams,
} from "@/features/dashboard/model/utm-attribution-filter"
import type { DashboardCustomRange } from "@/features/traffic/model/traffic-range"

export function appendDashboardUtmParams(
  url: URL,
  utmFilter?: DashboardUtmFilter | null
): void {
  const normalized = normalizeDashboardUtmFilter(utmFilter)
  if (!normalized) return
  if (normalized.utm_source) {
    url.searchParams.set("utm_source", normalized.utm_source)
  }
  if (normalized.utm_medium) {
    url.searchParams.set("utm_medium", normalized.utm_medium)
  }
}

export function appendDashboardCustomRangeParams(
  url: URL,
  rangeId: string,
  customRange?: DashboardCustomRange | null
): void {
  if (rangeId !== "custom" || !customRange) return
  url.searchParams.set("from", customRange.from)
  url.searchParams.set("to", customRange.to)
}

export function parseUtmFilterFromSearchParams(
  searchParams: URLSearchParams
): DashboardUtmFilter | undefined {
  return parseDashboardUtmFilterFromParams({
    utm_source: searchParams.get("utm_source"),
    utm_medium: searchParams.get("utm_medium"),
    utm_dim: searchParams.get("utm_dim"),
    utm_value: searchParams.get("utm_value"),
  })
}

export function appendUtmFilterToQueryString(
  baseQuery: string,
  utmFilter?: DashboardUtmFilter | null
): string {
  const normalized = normalizeDashboardUtmFilter(utmFilter)
  if (!normalized || !hasDashboardUtmFilter(normalized)) return baseQuery
  const params = new URLSearchParams(baseQuery.replace(/^\?/, ""))
  params.delete("utm_dim")
  params.delete("utm_value")
  if (normalized.utm_source) params.set("utm_source", normalized.utm_source)
  else params.delete("utm_source")
  if (normalized.utm_medium) params.set("utm_medium", normalized.utm_medium)
  else params.delete("utm_medium")
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}
