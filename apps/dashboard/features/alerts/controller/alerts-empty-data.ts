import type { AlertsDashboardData } from "@/features/alerts/model/alerts"
import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import { TRAFFIC_DATE_RANGE_OPTIONS } from "@/features/traffic/model/traffic-range"

export function getAlertsEmptyDashboardData(
  _landingPagePublicId: string,
  rangeId: OverviewDateRangeId = "7d"
): AlertsDashboardData {
  void _landingPagePublicId

  return {
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: rangeId,
    items: [],
  }
}
