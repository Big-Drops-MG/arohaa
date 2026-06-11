export type RangeId = '24h' | '7d' | '30d' | '3m' | '12m' | '24m'

export interface AnalyticsEventsKpis {
  totalEvents: number
  zipSubmit: number
  callClicks: number
  formSubmitted: number
  fsr: number
}

export interface AnalyticsEventsSubmissionRow {
  date: string
  formSubmitted: number
  fsr: number
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
