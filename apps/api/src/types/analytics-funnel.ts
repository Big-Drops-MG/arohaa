import {
  ANALYTICS_RANGE_IDS,
  isAnalyticsRangeId,
  type AnalyticsRangeId,
} from '../lib/analytics-range.js'

export type FunnelRangeId = AnalyticsRangeId

export const FUNNEL_RANGE_IDS = ANALYTICS_RANGE_IDS

export function isFunnelRangeId(value: string): value is FunnelRangeId {
  return isAnalyticsRangeId(value)
}

export interface FunnelMetricRow {
  label: string
  count: number
  changePct: number | null
}

export interface FunnelMultiStepRow {
  label: string
  count: number
  changePct: number | null
}

export interface FunnelDropOffRow {
  fieldName: string
  dropOffs: number
  percentDrop: number
  emphasized: boolean
}

export interface FunnelDashboardResponse {
  rangeId: FunnelRangeId
  metrics: FunnelMetricRow[]
  multiStepSteps: FunnelMultiStepRow[]
  dropOffRows: FunnelDropOffRow[]
}
