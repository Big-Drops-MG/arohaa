export type InsightSectionId =
  | 'volume'
  | 'source'
  | 'time'
  | 'age'
  | 'dropoff'
  | 'device'
  | 'geo'
  | 'risk'
  | 'vehicle'
  | 'quality'
  | 'experiment'

export const INSIGHT_SECTION_IDS: readonly InsightSectionId[] = [
  'volume',
  'source',
  'time',
  'age',
  'dropoff',
  'device',
  'geo',
  'risk',
  'vehicle',
  'quality',
  'experiment',
] as const

export function isInsightSectionId(value: string): value is InsightSectionId {
  return (INSIGHT_SECTION_IDS as readonly string[]).includes(value)
}

export type InsightChartType =
  | 'line'
  | 'multi-line'
  | 'bar'
  | 'stacked-bar'
  | 'stacked-area'
  | 'heatmap'
  | 'horizontal-bar'
  | 'table'
  | 'us-map'

export type InsightKpi = {
  id: string
  label: string
  value: number
  format: 'number' | 'percent' | 'decimal'
}

export type InsightChartPoint = Record<string, string | number | null>

export type InsightTableColumn = {
  key: string
  label: string
}

export type InsightChart = {
  id: string
  title: string
  helper?: string
  type: InsightChartType
  fullWidth?: boolean
  seriesKeys?: string[]
  xKey?: string
  yKey?: string
  rowKeys?: string[]
  colKeys?: string[]
  points: InsightChartPoint[]
  columns?: InsightTableColumn[]
  emptyMessage?: string
}

export type AnalyticsInsights = {
  section: InsightSectionId
  kpis: InsightKpi[]
  charts: InsightChart[]
}

export function emptyAnalyticsInsights(
  section: InsightSectionId,
): AnalyticsInsights {
  return { section, kpis: [], charts: [] }
}
