import type { AnalyticsRangeId } from '../lib/analytics-range.js'

export type RangeId = AnalyticsRangeId

export interface AnalyticsExperimentRow {
  id: string
  name: string
  status: string
  variants: string
  startDate: string
  endDate?: string | null
  noEndDate?: boolean
  highlighted?: boolean
}

export interface AnalyticsVariantPerformanceRow {
  variant: string
  visitors: number
  formSubmitted: number
  fsr: number
  isControl?: boolean
  visitorsLiftAbs?: number | null
  visitorsLiftPct?: number | null
  formSubmittedLiftAbs?: number | null
  formSubmittedLiftPct?: number | null
  fsrLiftAbs?: number | null
  fsrLiftPct?: number | null
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
  controlVariant?: string | null
  mode?: 'multi_domain' | 'data_variant'
}
