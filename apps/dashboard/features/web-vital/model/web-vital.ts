import type { OverviewDateRangeId } from "@/features/overview/model/overview"

export type WebVitalName = "LCP" | "FCP" | "CLS" | "INP"

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

export type WebVitalDashboardData = {
  dateRangeOptions: Array<{ id: OverviewDateRangeId; label: string }>
  defaultDateRangeId: OverviewDateRangeId
  lighthouseScore: number | null
  metrics: WebVitalMetricSummary[]
  devices: WebVitalDeviceBreakdown[]
  states: WebVitalStateMetric[]
  totalSamples: number
}

/** Zeroed device rows when no field vitals exist yet. */
export const WEB_VITAL_EMPTY_DEVICES: WebVitalDeviceBreakdown[] = [
  {
    device: "desktop",
    fcpP75: 0,
    lcpP75: 0,
    clsP75: 0,
    inpP75: 0,
    samples: 0,
    performanceScore: 0,
  },
  {
    device: "tablet",
    fcpP75: 0,
    lcpP75: 0,
    clsP75: 0,
    inpP75: 0,
    samples: 0,
    performanceScore: 0,
  },
  {
    device: "mobile",
    fcpP75: 0,
    lcpP75: 0,
    clsP75: 0,
    inpP75: 0,
    samples: 0,
    performanceScore: 0,
  },
]
