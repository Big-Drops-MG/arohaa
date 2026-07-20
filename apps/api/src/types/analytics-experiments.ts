import type { AnalyticsRangeId } from '../lib/analytics-range.js'

export type RangeId = AnalyticsRangeId

export interface AnalyticsExperimentRow {
  id: string
  name: string
  status: string
  variants: string
  startDate: string
  highlighted?: boolean
}

export interface AnalyticsVariantPerformanceRow {
  variant: string
  visitors: number
  formSubmitted: number
  fsr: number
}

export interface AnalyticsLocationPerformanceRow {
  city: string
  [variantKey: string]: string | number
}

export interface AnalyticsStatePerformanceRow {
  state: string
  [variantKey: string]: string | number
}

export interface AnalyticsZipcodePerformanceRow {
  zipcode: string
  [variantKey: string]: string | number
}

export interface AnalyticsExperiments {
  experiments: AnalyticsExperimentRow[]
  variantPerformance: AnalyticsVariantPerformanceRow[]
  performanceByLocation: AnalyticsLocationPerformanceRow[]
  performanceByState: AnalyticsStatePerformanceRow[]
  performanceByZipcode: AnalyticsZipcodePerformanceRow[]
}
