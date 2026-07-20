import type { AlertsDashboardData } from "@/features/alerts/model/alerts"
import { TRAFFIC_DATE_RANGE_OPTIONS } from "@/features/traffic/model/traffic-range"

export function getAlertsPlaceholderData(
  _landingPagePublicId: string
): AlertsDashboardData {
  void _landingPagePublicId

  return {
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: "7d",
    items: [
      {
        id: "1",
        message: "Bounce rate increased by 10%",
        dateLabel: "Apr 10",
        severity: "warning",
      },
      {
        id: "2",
        message: "Traffic spike detected",
        dateLabel: "Apr 9",
        severity: "alert",
      },
      {
        id: "3",
        message: "FSR dropped by 15%",
        dateLabel: "Apr 8",
        severity: "warning",
      },
      {
        id: "4",
        message: "Step 2 drop-off increased",
        dateLabel: "Apr 7",
        severity: "error",
      },
      {
        id: "5",
        message: "Form starts decreased",
        dateLabel: "Apr 7",
        severity: "warning",
      },
    ],
  }
}
