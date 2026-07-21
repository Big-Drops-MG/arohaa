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
  /** Weekday name (e.g. Monday) or device/city label. */
  label: string
  /** Calendar date label for day-series rows (e.g. Jul 14). */
  date?: string
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
