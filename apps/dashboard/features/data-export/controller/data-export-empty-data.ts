import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import type { DataExportDashboardData } from "@/features/data-export/model/data-export"
import { TRAFFIC_DATE_RANGE_OPTIONS } from "@/features/traffic/model/traffic-range"

export function getDataExportEmptyDashboardData(
  rangeId: OverviewDateRangeId = "7d",
  hasRedirect = false
): DataExportDashboardData {
  return {
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: rangeId,
    leads: [],
    total: 0,
    limit: 15,
    offset: 0,
    hasMore: false,
    hasRedirect,
  }
}
