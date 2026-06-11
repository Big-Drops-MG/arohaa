import type { AnalyticsRangeId } from '../lib/analytics-range.js'

export type FunnelRangeId = AnalyticsRangeId

export const FUNNEL_RANGE_IDS = [
  '24h',
  '7d',
  '30d',
  '3m',
  '12m',
  '24m',
] as const satisfies readonly FunnelRangeId[]

export function isFunnelRangeId(value: string): value is FunnelRangeId {
  return (FUNNEL_RANGE_IDS as readonly string[]).includes(value)
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
