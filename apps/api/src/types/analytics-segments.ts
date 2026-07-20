import type { AnalyticsRangeId } from '../lib/analytics-range.js'

export type RangeId = AnalyticsRangeId

export interface AnalyticsSegmentsSummaryKpis {
  topRegion: string
  topDevice: string
  bestDay: string
  bestTime: string
  highestFsr: number
}

export interface AnalyticsSegmentsRow {
  label: string
  visitors: number
  formSubmitted: number
  fsr: number
}

export interface AnalyticsSegments {
  summaryKpis: AnalyticsSegmentsSummaryKpis
  performanceByLocation: AnalyticsSegmentsRow[]
  performanceByDevice: AnalyticsSegmentsRow[]
  performanceByTime: AnalyticsSegmentsRow[]
}
