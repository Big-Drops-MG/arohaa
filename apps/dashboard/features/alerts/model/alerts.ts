import type {
  OverviewAlert,
  OverviewDateRangeId,
  OverviewDateRangeOption,
} from "@/features/overview/model/overview"

export type AlertsByDateRange = Record<OverviewDateRangeId, OverviewAlert[]>

export type AlertsDashboardData = {
  dateRangeOptions: OverviewDateRangeOption[]
  defaultDateRangeId: OverviewDateRangeId
  items: OverviewAlert[]
}
