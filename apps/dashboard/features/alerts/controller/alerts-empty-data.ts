import type { AlertsDashboardData } from "@/features/alerts/model/alerts"
import type { OverviewDateRangeId } from "@/features/overview/model/overview"

export function getAlertsEmptyDashboardData(
  _landingPagePublicId: string,
  rangeId: OverviewDateRangeId = "7d"
): AlertsDashboardData {
  void _landingPagePublicId

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
    items: [],
  }
}
