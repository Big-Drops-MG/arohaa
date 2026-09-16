import type {
  OverviewDateRangeId,
  OverviewDateRangeOption,
} from "@/features/overview/model/overview"
import type { Level1Stat } from "@/features/data-lab/model/level1"
import type { Level2Stat } from "@/features/data-lab/model/level2"
import type { IntelligenceCenterPayload } from "@/features/data-lab/model/intelligence"

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
  returnCount: number
  fields: Record<string, string>
}

export type DataExportDashboardData = {
  brandName: string
  dateRangeOptions: OverviewDateRangeOption[]
  defaultDateRangeId: OverviewDateRangeId
  leads: DataExportLeadRow[]
  visibleLeadFieldKeys: string[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
  hasRedirect: boolean
  level1Stats: Level1Stat[]
  level1Complete: boolean
  level2Stats: Level2Stat[]
  level2Complete: boolean
  level3: IntelligenceCenterPayload | null
  level3Complete: boolean
}

export const DATA_EXPORT_PAGE_SIZE = 15
