export interface AnalyticsAlertItem {
  id: string
  message: string
  date: string
  severity: "warning" | "info"
}

export interface AnalyticsAlertsResponse {
  items: AnalyticsAlertItem[]
}
