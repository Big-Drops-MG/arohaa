import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import type { SeoDashboardData } from "@/features/seo/model/seo"
import { TRAFFIC_DATE_RANGE_OPTIONS } from "@/features/traffic/model/traffic-range"

export function getSeoEmptyDashboardData(
  _projectId: string,
  rangeId: OverviewDateRangeId = "7d"
): SeoDashboardData {
  return {
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: rangeId,
    defaultSortBy: "clicks",
    defaultSortOrder: "desc",
    source: "organic",
    gsc: {
      connected: false,
      siteUrl: null,
      accountEmail: null,
      lastSyncedAt: null,
    },
    summary: {
      totalClicks: 0,
      totalImpressions: 0,
      avgCtr: 0,
      avgPosition: 0,
      rowCount: 0,
    },
    content: [],
    rows: [],
  }
}
