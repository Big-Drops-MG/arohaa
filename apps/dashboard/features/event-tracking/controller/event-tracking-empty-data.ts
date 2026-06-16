import type { EventTrackingDashboardData } from "@/features/event-tracking/model/event-tracking"
import type {
  OverviewDateRangeId,
  OverviewLandingFormType,
} from "@/features/overview/model/overview"
import { eventTrackingKpisForFormType } from "@/features/event-tracking/utils/event-tracking-kpis-for-form-type"

export function getEventTrackingEmptyDashboardData(
  _landingPagePublicId: string,
  rangeId: OverviewDateRangeId = "7d",
  formType: OverviewLandingFormType = "single"
): EventTrackingDashboardData {
  void _landingPagePublicId

  const emptySource = {
    totalEvents: 0,
    callClicks: 0,
    formStarted: 0,
    zipSubmit: 0,
    formSubmitted: 0,
    fsr: 0,
    zsr: 0,
  }

  return {
    formType,
    dateRangeOptions: [
      { id: "24h", label: "Last 24 hours" },
      { id: "7d", label: "Last 7 days" },
      { id: "30d", label: "Last 30 days" },
      { id: "3m", label: "Last 3 months" },
      { id: "12m", label: "Last 12 months" },
      { id: "24m", label: "Last 24 months" },
    ],
    defaultDateRangeId: rangeId,
    kpis: eventTrackingKpisForFormType(formType, emptySource),
    submissionRows: [],
    kpiSegments: [],
    pieSegments: [],
  }
}
