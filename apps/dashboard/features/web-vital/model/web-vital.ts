import type { OverviewDateRangeId } from "@/features/overview/model/overview"

export type WebVitalName = "LCP" | "CLS" | "INP"

export type WebVitalRating = "good" | "needs-improvement" | "poor" | "none"

export type WebVitalMetricSummary = {
  name: WebVitalName
  p75: number
  avg: number
  samples: number
  rating: WebVitalRating
  score: number
  unit: "ms" | "unitless"
}

export type WebVitalDeviceBreakdown = {
  device: string
  lcpP75: number | null
  clsP75: number | null
  inpP75: number | null
  samples: number
  performanceScore: number | null
}

export type WebVitalStateMetric = {
  state: string
  lcpP75: number | null
  clsP75: number | null
  inpP75: number | null
  samples: number
  performanceScore: number | null
}

export type WebVitalDashboardData = {
  dateRangeOptions: Array<{ id: OverviewDateRangeId; label: string }>
  defaultDateRangeId: OverviewDateRangeId
  lighthouseScore: number | null
  metrics: WebVitalMetricSummary[]
  devices: WebVitalDeviceBreakdown[]
  states: WebVitalStateMetric[]
  totalSamples: number
}
