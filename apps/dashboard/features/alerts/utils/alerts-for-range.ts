import { defaultAlertsByDateRange } from "@/features/alerts/controller/alerts-default-payload"
import type { OverviewAlert } from "@/features/overview/model/overview"
import type {
  OverviewDashboardData,
  OverviewDateRangeId,
} from "@/features/overview/model/overview"

export function alertsForDateRange(
  data: OverviewDashboardData,
  rangeId: OverviewDateRangeId
): OverviewAlert[] {
  return data.alertsByDateRange[rangeId] ?? defaultAlertsByDateRange()[rangeId]
}
