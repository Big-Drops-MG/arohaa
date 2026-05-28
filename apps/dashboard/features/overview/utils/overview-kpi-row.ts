import {
  OVERVIEW_KPI_METRIC_ORDER,
  overviewKpiLabelsForFormType,
  type OverviewDashboardData,
  type OverviewDateRangeId,
  type OverviewKpi,
  type OverviewKpiMetricId,
} from "@/features/overview/model/overview"

function defaultKpiDisplayValue(id: OverviewKpiMetricId): string {
  if (id === "fsr" || id === "bounce-rate") return "0%"
  return "0"
}

export function overviewKpisForDateRange(
  data: OverviewDashboardData,
  rangeId: OverviewDateRangeId
): OverviewKpi[] {
  const values = data.kpisByDateRange[rangeId] ?? {}
  const labels = overviewKpiLabelsForFormType(data.formType)
  return OVERVIEW_KPI_METRIC_ORDER.map((id) => {
    const raw = values[id]
    const trimmed = raw?.trim() ?? ""
    return {
      id,
      label: labels[id],
      value: trimmed.length > 0 ? raw! : defaultKpiDisplayValue(id),
    }
  })
}
