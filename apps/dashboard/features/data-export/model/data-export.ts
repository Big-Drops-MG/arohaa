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
  /** True when level1Stats cover the whole range rather than just this page. */
  level1Complete: boolean
  level2Stats: Level2Stat[]
  /** True when level2Stats cover the whole range rather than just this page. */
  level2Complete: boolean
  level3: IntelligenceCenterPayload | null
  /** True when level3 covers the whole range rather than just this page. */
  level3Complete: boolean
}

export const DATA_EXPORT_PAGE_SIZE = 15
