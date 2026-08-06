import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import {
  DATA_EXPORT_PAGE_SIZE,
  type DataExportDashboardData,
} from "@/features/data-export/model/data-export"
import { TRAFFIC_DATE_RANGE_OPTIONS } from "@/features/traffic/model/traffic-range"

export function getDataExportEmptyDashboardData(
  rangeId: OverviewDateRangeId = "7d",
  hasRedirect = false,
  brandName = ""
): DataExportDashboardData {
  return {
    brandName,
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: rangeId,
    leads: [],
    total: 0,
    limit: DATA_EXPORT_PAGE_SIZE,
    offset: 0,
    hasMore: false,
    hasRedirect,
  }
}
