import type { EventTrackingDashboardData } from "@/features/event-tracking/model/event-tracking"
import type {
  OverviewDateRangeId,
  OverviewLandingFormType,
} from "@/features/overview/model/overview"
import { eventTrackingKpisForFormType } from "@/features/event-tracking/utils/event-tracking-kpis-for-form-type"
import { TRAFFIC_DATE_RANGE_OPTIONS } from "@/features/traffic/model/traffic-range"

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
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: rangeId,
    kpis: eventTrackingKpisForFormType(formType, emptySource),
    submissionRows: [],
    kpiSegments: [],
    pieSegments: [],
  }
}
