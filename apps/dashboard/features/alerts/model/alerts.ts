import type {
  OverviewDateRangeId,
  OverviewDateRangeOption,
} from "@/features/overview/model/overview"

export type AlertsListItemSeverity = "warning" | "info"

export type AlertsListItem = {
  id: string
  message: string
  date: string
  severity: AlertsListItemSeverity
}

export type AlertsDashboardData = {
  dateRangeOptions: OverviewDateRangeOption[]
  defaultDateRangeId: OverviewDateRangeId
  items: AlertsListItem[]
}
