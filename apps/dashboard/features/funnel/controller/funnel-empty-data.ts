import type {
  OverviewDateRangeId,
  OverviewLandingFormType,
} from "@/features/overview/model/overview"
import { TRAFFIC_DATE_RANGE_OPTIONS } from "@/features/traffic/model/traffic-range"
import type { FunnelDashboardData } from "@/features/funnel/model/funnel"
import {
  defaultFunnelMetricKpis,
  defaultMultiStepFormTracking,
} from "@/features/funnel/controller/funnel-default-payload"

export function getFunnelEmptyDashboardData(
  _landingPagePublicId: string,
  rangeId: OverviewDateRangeId = "7d",
  formType: OverviewLandingFormType = "single"
): FunnelDashboardData {
  void _landingPagePublicId

  return {
    formType,
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: rangeId,
    defaultKpiMetricId: "landing-page-visits",
    metrics: defaultFunnelMetricKpis(formType),
    multiStepSteps: defaultMultiStepFormTracking(),
    dropOffRows: [],
  }
}
