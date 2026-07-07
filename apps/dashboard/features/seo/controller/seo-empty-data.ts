import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import type { SeoDashboardData } from "@/features/seo/model/seo"

export function getSeoEmptyDashboardData(
  _projectId: string,
  rangeId: OverviewDateRangeId = "7d"
): SeoDashboardData {
  return {
    dateRangeOptions: [
      { id: "24h", label: "Last 24 hours" },
      { id: "7d", label: "Last 7 days" },
      { id: "30d", label: "Last 30 days" },
      { id: "3m", label: "Last 3 months" },
      { id: "12m", label: "Last 12 months" },
      { id: "24m", label: "Last 24 months" },
    ],
    defaultDateRangeId: rangeId,
    defaultSortBy: "clicks",
    defaultSortOrder: "desc",
    summary: {
      totalClicks: 0,
      totalImpressions: 0,
      avgCtr: 0,
      avgPosition: 0,
      rowCount: 0,
    },
    rows: [],
  }
}
