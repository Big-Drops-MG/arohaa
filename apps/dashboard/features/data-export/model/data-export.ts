import type {
  OverviewDateRangeId,
  OverviewDateRangeOption,
} from "@/features/overview/model/overview"

export type DataExportLeadRow = {
  sessionId: string
  createdAt: string
  zip: string
  email: string
  fields: Record<string, string>
}

export type DataExportDashboardData = {
  dateRangeOptions: OverviewDateRangeOption[]
  defaultDateRangeId: OverviewDateRangeId
  leads: DataExportLeadRow[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
  hasRedirect: boolean
}
