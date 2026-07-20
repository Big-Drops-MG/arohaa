import type { AnalyticsRangeId } from '../lib/analytics-range.js'

export type RangeId = AnalyticsRangeId

export interface AnalyticsEventsKpis {
  totalEvents: number
  zipSubmit: number
  callClicks: number
  formStarted: number
  formSubmitted: number
  fsr: number
  zsr: number
}

export interface AnalyticsEventsSubmissionRow {
  date: string
  zipSubmitted: number
  formSubmitted: number
  fsr: number
  zsr: number
}

export interface AnalyticsEventsPieSegment {
  name: string
  value: number
}

export interface AnalyticsEvents {
  kpis: AnalyticsEventsKpis
  submissionRows: AnalyticsEventsSubmissionRow[]
  pieSegments: AnalyticsEventsPieSegment[]
}
