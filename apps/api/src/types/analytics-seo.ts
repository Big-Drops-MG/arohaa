export type RangeId = '24h' | '7d' | '30d' | '3m' | '12m' | '24m'

export type SeoSortField = 'clicks' | 'impressions' | 'ctr' | 'position' | 'query'

export interface SeoResultRow {
  id: string
  query: string
  pageUrl: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  reportDate: string
}

export interface AnalyticsSeo {
  rangeId: RangeId
  sortBy: SeoSortField
  sortOrder: 'asc' | 'desc'
  summary: {
    totalClicks: number
    totalImpressions: number
    avgCtr: number
    avgPosition: number
    rowCount: number
  }
  rows: SeoResultRow[]
}

export interface SeoSyncRowInput {
  query: string
  pageUrl: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  reportDate: string
}
