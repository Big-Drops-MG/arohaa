import {
  overviewKpiLabelsForFormType,
  overviewKpiMetricOrder,
  type OverviewDashboardData,
  type OverviewDateRangeId,
  type OverviewKpi,
  type OverviewKpiMetricId,
} from "@/features/overview/model/overview"
import { formatFunnelTrendChange } from "@/features/funnel/utils/funnel-trend"

function defaultKpiDisplayValue(id: OverviewKpiMetricId): string {
  if (id === "fsr" || id === "bounce-rate") return "0%"
  return "0"
}

export function overviewKpisForDateRange(
  data: OverviewDashboardData,
  rangeId: OverviewDateRangeId
): OverviewKpi[] {
  const values = data.kpisByDateRange[rangeId] ?? {}
  const changes = data.kpiChangesByDateRange?.[rangeId] ?? {}
  const labels = overviewKpiLabelsForFormType(data.formType)
  return overviewKpiMetricOrder(data.formType).map((id) => {
    const raw = values[id]
    const trimmed = raw?.trim() ?? ""
    return {
      id,
      label: labels[id],
      value: trimmed.length > 0 ? raw! : defaultKpiDisplayValue(id),
      ...formatFunnelTrendChange(changes[id]),
    }
  })
}
