import type {
  OverviewAlert,
  OverviewAlertSeverity,
} from "@/features/overview/model/overview"

export type AlertsSeverityFilterValue = OverviewAlertSeverity | "all"

export function countAlertsBySeverity(
  alerts: OverviewAlert[]
): Record<OverviewAlertSeverity, number> {
  const counts: Record<OverviewAlertSeverity, number> = {
    warning: 0,
    alert: 0,
    error: 0,
  }

  for (const alert of alerts) {
    counts[alert.severity] += 1
  }

  return counts
}

export function filterAlertsBySeverity(
  alerts: OverviewAlert[],
  filter: AlertsSeverityFilterValue
): OverviewAlert[] {
  if (filter === "all") return alerts
  return alerts.filter((alert) => alert.severity === filter)
}

export function emptyAlertsFilterMessage(
  filter: AlertsSeverityFilterValue
): string {
  if (filter === "warning") return "No warnings for this period."
  if (filter === "alert") return "No alerts for this period."
  if (filter === "error") return "No errors for this period."
  return "No alerts for this period."
}
