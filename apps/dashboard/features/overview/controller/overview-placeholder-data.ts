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

const emptyKpisByDateRange: OverviewKpiValuesByDateRange = {
  "24h": {},
  "7d": {},
  "30d": {},
  "3m": {},
  "12m": {},
  "24m": {},
}

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
  dateRangeOptions: [
    { id: "24h", label: "Last 24 hours" },
    { id: "7d", label: "Last 7 days" },
    { id: "30d", label: "Last 30 days" },
    { id: "3m", label: "Last 3 months" },
    { id: "12m", label: "Last 12 months" },
    { id: "24m", label: "Last 24 months" },
  ],
  defaultDateRangeId: "7d",
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
