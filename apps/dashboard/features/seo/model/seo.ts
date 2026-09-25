import type { OverviewDateRangeId } from "@/features/overview/model/overview"

export type SeoSortField =
  | "clicks"
  | "impressions"
  | "ctr"
  | "position"
  | "query"
export type SeoSortOrder = "asc" | "desc"
export type SeoSource = "gsc" | "organic"

export type SeoResultRow = {
  id: string
  query: string
  pageUrl: string
  pageTitle?: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  reportDate: string
}

export type SeoContentItem = {
  pageUrl: string
  pageTitle: string
  clicks: number
  previousClicks: number
  changePct: number | null
}

export type SeoSummary = {
  totalClicks: number
  totalImpressions: number
  avgCtr: number
  avgPosition: number
  rowCount: number
}

export type SeoGscMeta = {
  connected: boolean
  siteUrl: string | null
  accountEmail: string | null
  lastSyncedAt: string | null
}

export type SeoDashboardData = {
  dateRangeOptions: Array<{ id: OverviewDateRangeId; label: string }>
  defaultDateRangeId: OverviewDateRangeId
  defaultSortBy: SeoSortField
  defaultSortOrder: SeoSortOrder
  source: SeoSource
  gsc: SeoGscMeta
  summary: SeoSummary
  content: SeoContentItem[]
  rows: SeoResultRow[]
}
