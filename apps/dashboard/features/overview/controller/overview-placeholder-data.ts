import type {
  OverviewDashboardData,
  OverviewKpiValuesByDateRange,
  OverviewLandingFormType,
} from "@/features/overview/model/overview"
import {
  defaultAlerts,
  defaultFunnelSteps,
  defaultSegmentStats,
  defaultTrafficStats,
} from "@/features/overview/controller/overview-default-payload"

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
  "formType" | "funnel"
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
  }
}
