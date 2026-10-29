import type {
  OverviewDateRangeId,
  OverviewDateRangeOption,
} from "@/features/overview/model/overview"
import type { Level1Stat } from "@/features/data-lab/model/level1"
import type { Level2Stat } from "@/features/data-lab/model/level2"
import type { LeadQualityRow } from "@/features/data-lab/model/lead-quality"
import type { IntelligenceCenterPayload } from "@/features/data-lab/model/intelligence"
import type { LeadFraudAssessment } from "@/features/data-export/model/interaction-log"

export type { LeadFraudAssessment }

export type LeadBehaviorSummary = {
  reason: string
  observedAt: string
  visibleMs: number
  activeMs: number
  focusCount: number
  inputCount: number
  changeCount: number
  pasteCount: number
  autofillHints: number
  pointerCount: number
  touchCount: number
  keyboardCount: number
  trustedEventCount: number
  untrustedEventCount: number
  formStartAt: number | null
  formSubmitAt: number | null
  sdkInitMs: number | null
}

export type DataExportLeadRow = {
  sessionId: string
  macId: string
  createdAt: string
  submittedAt: string | null
  zip: string
  clientIp: string
  email: string
  utmSource: string
  utmId: string
  trustedFormUrl: string
  formSubmitted: boolean
  returnCount: number
  fields: Record<string, string>
  fraud: LeadFraudAssessment | null
  behavior: LeadBehaviorSummary | null
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
  leadQuality: LeadQualityRow[]
  leadQualityComplete: boolean
  analyticsUnavailable?: boolean
}

export const DATA_EXPORT_PAGE_SIZE = 15
