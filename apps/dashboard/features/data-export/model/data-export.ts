import type {
  OverviewDateRangeId,
  OverviewDateRangeOption,
} from "@/features/overview/model/overview"

export type DataExportLeadRow = {
  sessionId: string
  createdAt: string
  zip: string
  email: string
  utmSource: string
  utmId: string
  trustedFormUrl: string
  formSubmitted: boolean
  fields: Record<string, string>
}

export type DataExportDashboardData = {
  brandName: string
  dateRangeOptions: OverviewDateRangeOption[]
  defaultDateRangeId: OverviewDateRangeId
  leads: DataExportLeadRow[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
  hasRedirect: boolean
}

export const DATA_EXPORT_PAGE_SIZE = 15
