import type { AnalyticsRangeId } from '../lib/analytics-range.js'

export type RangeId = AnalyticsRangeId

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
