export type RangeId = '24h' | '7d' | '30d' | '3m' | '12m' | '24m'

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
  [variantKey: string]: string | number // Dynamic keys like 'variantA', 'variantB'
}

export interface AnalyticsExperiments {
  experiments: AnalyticsExperimentRow[]
  variantPerformance: AnalyticsVariantPerformanceRow[]
  performanceByLocation: AnalyticsLocationPerformanceRow[]
}
