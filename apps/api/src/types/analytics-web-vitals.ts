import type { AnalyticsRangeId } from '../lib/analytics-range.js'

export type WebVitalName = 'LCP' | 'FCP' | 'CLS' | 'INP'

export type WebVitalRating = 'good' | 'needs-improvement' | 'poor' | 'none'

export type WebVitalMetricSummary = {
  name: WebVitalName
  p75: number
  avg: number
  samples: number
  rating: WebVitalRating
  /** 0–100 Lighthouse-style metric score */
  score: number
  unit: 'ms' | 'unitless'
}

export type WebVitalDeviceBreakdown = {
  device: string
  fcpP75: number | null
  lcpP75: number | null
  clsP75: number | null
  inpP75: number | null
  samples: number
  performanceScore: number | null
}

export type WebVitalStateMetric = {
  state: string
  fcpP75: number | null
  lcpP75: number | null
  clsP75: number | null
  inpP75: number | null
  samples: number
  performanceScore: number | null
}

export type AnalyticsWebVitals = {
  rangeId: AnalyticsRangeId
  /** Composite 0–100 score from FCP / LCP / INP / CLS. */
  lighthouseScore: number | null
  metrics: WebVitalMetricSummary[]
  devices: WebVitalDeviceBreakdown[]
  states: WebVitalStateMetric[]
  totalSamples: number
}
