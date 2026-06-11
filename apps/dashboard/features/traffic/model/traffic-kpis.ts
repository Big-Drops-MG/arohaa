export type TrafficKpiMetricId =
  | "visitors"
  | "sessions"
  | "page-views"
  | "bounce-rate"

export const TRAFFIC_KPI_METRIC_ORDER: readonly TrafficKpiMetricId[] = [
  "visitors",
  "sessions",
  "page-views",
  "bounce-rate",
]

export const TRAFFIC_KPI_LABELS: Record<TrafficKpiMetricId, string> = {
  visitors: "Visitors",
  sessions: "Sessions",
  "page-views": "Page Views",
  "bounce-rate": "Bounce Rate",
}

export type TrafficKpi = {
  id: TrafficKpiMetricId
  label: string
  value: string
}
