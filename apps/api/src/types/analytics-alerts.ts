export type AnalyticsAlertKind =
  | "traffic_drop"
  | "traffic_spike"
  | "traffic_spike_from_low"
  | "weekly_traffic_hike"
  | "monthly_form_hike"
  | "fsr_drop"
  | "form_starts_drop"

export interface AnalyticsAlertItem {
  id: string
  kind: AnalyticsAlertKind
  message: string
  date: string
  severity: "warning" | "info"
}

export interface AnalyticsAlertsResponse {
  items: AnalyticsAlertItem[]
}
