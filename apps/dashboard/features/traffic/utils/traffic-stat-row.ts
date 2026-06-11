import {
  TRAFFIC_KPI_LABELS,
  TRAFFIC_KPI_METRIC_ORDER,
  type TrafficKpi,
  type TrafficKpiMetricId,
} from "@/features/traffic/model/traffic-kpis"
import type {
  OverviewDashboardData,
  OverviewDateRangeId,
} from "@/features/overview/model/overview"

function defaultTrafficKpiDisplayValue(id: TrafficKpiMetricId): string {
  if (id === "bounce-rate") return "0%"
  return "0"
}

export function trafficKpisForDateRange(
  data: OverviewDashboardData,
  rangeId: OverviewDateRangeId
): TrafficKpi[] {
  const values = data.kpisByDateRange[rangeId] ?? {}
  return TRAFFIC_KPI_METRIC_ORDER.map((id) => {
    const raw = values[id]
    const trimmed = raw?.trim() ?? ""
    return {
      id,
      label: TRAFFIC_KPI_LABELS[id],
      value: trimmed.length > 0 ? raw! : defaultTrafficKpiDisplayValue(id),
    }
  })
}
