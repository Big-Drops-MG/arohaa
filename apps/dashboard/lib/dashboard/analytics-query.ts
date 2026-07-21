import {
  hasDashboardUtmFilter,
  normalizeDashboardUtmFilter,
  serializeUtmValueList,
  type DashboardUtmFilter,
} from "@/features/dashboard/model/utm-attribution-filter"
import type { DashboardCustomRange } from "@/features/traffic/model/traffic-range"

export function buildAnalyticsApiPath(
  path: string,
  params: {
    rangeId?: string
    customRange?: DashboardCustomRange | null
    utmFilter?: DashboardUtmFilter | null
    extra?: Record<string, string>
  }
): string {
  const url = new URL(path, "http://localhost")
  if (params.rangeId) {
    url.searchParams.set("range_id", params.rangeId)
  }
  if (params.rangeId === "custom" && params.customRange) {
    url.searchParams.set("from", params.customRange.from)
    url.searchParams.set("to", params.customRange.to)
  }
  const utm = normalizeDashboardUtmFilter(params.utmFilter)
  const source = serializeUtmValueList(utm?.utm_source)
  const s1 = serializeUtmValueList(utm?.utm_s1)
  if (source) url.searchParams.set("utm_source", source)
  if (s1) url.searchParams.set("utm_s1", s1)
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
  utmFilter?: DashboardUtmFilter | null,
  customRange?: DashboardCustomRange | null,
  defaultCustomRange?: DashboardCustomRange | null
): boolean {
  if (hasDashboardUtmFilter(utmFilter)) return false
  if (dateRangeId !== defaultDateRangeId) return false
  if (dateRangeId === "custom") {
    return (
      !!customRange &&
      !!defaultCustomRange &&
      customRange.from === defaultCustomRange.from &&
      customRange.to === defaultCustomRange.to
    )
  }
  return true
}
