import type { AnalyticsRangeId } from '../lib/analytics-range.js'

export type RangeId = AnalyticsRangeId

export type SeoSortField = 'clicks' | 'impressions' | 'ctr' | 'position' | 'query'

export type SeoSource = 'gsc' | 'organic'

export interface SeoResultRow {
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

export interface SeoContentItem {
  pageUrl: string
  pageTitle: string
  clicks: number
  previousClicks: number
  changePct: number | null
}

export interface AnalyticsSeo {
  rangeId: RangeId
  sortBy: SeoSortField
  sortOrder: 'asc' | 'desc'
  source: SeoSource
  gsc: {
    connected: boolean
    siteUrl: string | null
    accountEmail: string | null
    lastSyncedAt: string | null
  }
  summary: {
    totalClicks: number
    totalImpressions: number
    avgCtr: number
    avgPosition: number
    rowCount: number
  }
  content: SeoContentItem[]
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
