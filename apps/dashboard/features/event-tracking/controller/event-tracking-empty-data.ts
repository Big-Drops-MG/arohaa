import type { EventTrackingDashboardData } from "@/features/event-tracking/model/event-tracking"
import type { OverviewDateRangeId } from "@/features/overview/model/overview"

export function getEventTrackingEmptyDashboardData(
  _landingPagePublicId: string,
  rangeId: OverviewDateRangeId = "7d"
): EventTrackingDashboardData {
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
    kpis: [
      { label: "Total Events", value: "0" },
      { label: "ZIP Submit", value: "0" },
      { label: "Call Clicks", value: "0" },
      { label: "Form Submitted", value: "0" },
      { label: "FSR", value: "0%" },
    ],
    submissionRows: [],
    pieSegments: [],
  }
}
