export type RangeId = '24h' | '7d' | '30d' | '3m' | '12m' | '24m'

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
