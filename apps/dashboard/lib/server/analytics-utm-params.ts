import type { DashboardUtmFilter } from "@/features/dashboard/model/utm-attribution-filter"
import {
  hasDashboardUtmFilter,
  normalizeDashboardUtmFilter,
  parseDashboardUtmFilterFromParams,
  serializeUtmValueList,
} from "@/features/dashboard/model/utm-attribution-filter"
import type { DashboardCustomRange } from "@/features/traffic/model/traffic-range"

export function appendDashboardUtmParams(
  url: URL,
  utmFilter?: DashboardUtmFilter | null
): void {
  const normalized = normalizeDashboardUtmFilter(utmFilter)
  if (!normalized) return
  const source = serializeUtmValueList(normalized.utm_source)
  const s1 = serializeUtmValueList(normalized.utm_s1)
  if (source) url.searchParams.set("utm_source", source)
  if (s1) url.searchParams.set("utm_s1", s1)
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
    utm_s1: searchParams.get("utm_s1"),
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
  params.delete("utm_medium")
  const source = serializeUtmValueList(normalized.utm_source)
  const s1 = serializeUtmValueList(normalized.utm_s1)
  if (source) params.set("utm_source", source)
  else params.delete("utm_source")
  if (s1) params.set("utm_s1", s1)
  else params.delete("utm_s1")
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}
