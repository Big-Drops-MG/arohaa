import type {
  OverviewDateRangeId,
  OverviewDateRangeOption,
} from "@/features/overview/model/overview"
import type { Level1Stat } from "@/features/data-lab/model/level1"

export type DataExportLeadRow = {
  sessionId: string
  macId: string
  createdAt: string
  submittedAt: string | null
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
  level1Stats: Level1Stat[]
}

export const DATA_EXPORT_PAGE_SIZE = 15
