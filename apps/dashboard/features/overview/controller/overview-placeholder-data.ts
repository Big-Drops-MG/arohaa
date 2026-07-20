import type {
  OverviewDashboardData,
  OverviewKpiValuesByDateRange,
  OverviewLandingFormType,
} from "@/features/overview/model/overview"
import {
  defaultAlerts,
  defaultSegmentStats,
  defaultTrafficStats,
} from "@/features/overview/controller/overview-default-payload"
import {
  defaultFormDropOffByField,
  defaultFunnelSteps,
  defaultMultiStepFormTracking,
} from "@/features/funnel/controller/funnel-default-payload"
import { defaultTrafficTablesByDateRange } from "@/features/traffic/controller/traffic-default-payload"
import {
  defaultEventTrackingByDateRange,
  defaultEventTrackingKpiSegmentsByDateRange,
  defaultEventTrackingSubmissionByDateRange,
} from "@/features/event-tracking/controller/event-tracking-default-payload"
import { defaultAlertsByDateRange } from "@/features/alerts/controller/alerts-default-payload"
import { defaultExperimentsByDateRange } from "@/features/experiments/controller/experiments-default-payload"
import { defaultSegmentsByDateRange } from "@/features/segments/controller/segments-default-payload"
import { defaultSegmentsPerformanceByDateRange } from "@/features/segments/controller/segments-performance-default-payload"
import {
  DEFAULT_TRAFFIC_RANGE_ID,
  TRAFFIC_DATE_RANGE_OPTIONS,
  TRAFFIC_RANGE_IDS,
} from "@/features/traffic/model/traffic-range"

const emptyKpisByDateRange: OverviewKpiValuesByDateRange = Object.fromEntries(
  TRAFFIC_RANGE_IDS.map((id) => [id, {}])
) as OverviewKpiValuesByDateRange

const overviewPlaceholderShell: Omit<
  OverviewDashboardData,
  | "formType"
  | "funnel"
  | "multiStepFormTracking"
  | "formDropOffByField"
  | "trafficTablesByDateRange"
  | "eventTrackingByDateRange"
  | "eventTrackingSubmissionByDateRange"
  | "eventTrackingKpiSegmentsByDateRange"
  | "segmentsByDateRange"
  | "segmentsPerformanceByDateRange"
  | "experimentsByDateRange"
  | "alertsByDateRange"
> = {
  dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
  defaultDateRangeId: DEFAULT_TRAFFIC_RANGE_ID,
  kpisByDateRange: emptyKpisByDateRange,
  defaultKpiMetricId: "visitors",
  traffic: defaultTrafficStats(),
  segments: defaultSegmentStats(),
  alerts: defaultAlerts,
  activeUsersNow: "0 Users",
}

export function getOverviewPlaceholderData(
  _landingPagePublicId: string,
  formType: OverviewLandingFormType = "single"
): OverviewDashboardData {
  void _landingPagePublicId
  return {
    ...overviewPlaceholderShell,
    formType,
    funnel: defaultFunnelSteps(formType),
    multiStepFormTracking: defaultMultiStepFormTracking(),
    formDropOffByField: defaultFormDropOffByField(),
    trafficTablesByDateRange: defaultTrafficTablesByDateRange(formType),
    eventTrackingByDateRange: defaultEventTrackingByDateRange(),
    eventTrackingSubmissionByDateRange:
      defaultEventTrackingSubmissionByDateRange(),
    eventTrackingKpiSegmentsByDateRange:
      defaultEventTrackingKpiSegmentsByDateRange(),
    segmentsByDateRange: defaultSegmentsByDateRange(),
    segmentsPerformanceByDateRange:
      defaultSegmentsPerformanceByDateRange(formType),
    experimentsByDateRange: defaultExperimentsByDateRange(formType),
    alertsByDateRange: defaultAlertsByDateRange(),
  }
}
