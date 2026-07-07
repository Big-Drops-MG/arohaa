import type { OverviewDateRangeId } from "@/features/overview/model/overview"

export type SeoSortField =
  | "clicks"
  | "impressions"
  | "ctr"
  | "position"
  | "query"
export type SeoSortOrder = "asc" | "desc"

export type SeoResultRow = {
  id: string
  query: string
  pageUrl: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  reportDate: string
}

export type SeoSummary = {
  totalClicks: number
  totalImpressions: number
  avgCtr: number
  avgPosition: number
  rowCount: number
}

export type SeoDashboardData = {
  dateRangeOptions: Array<{ id: OverviewDateRangeId; label: string }>
  defaultDateRangeId: OverviewDateRangeId
  defaultSortBy: SeoSortField
  defaultSortOrder: SeoSortOrder
  summary: SeoSummary
  rows: SeoResultRow[]
}
