export type Level1Stat = {
  id: string
  label: string
  value: string
  metricLabel?: string
  metricValue?: number
  breakdown?: Array<{ label: string; value: number }>
  enoughData: boolean
}

export type Level2Stat = Level1Stat

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
  | 'intelligence'
  | 'level1'

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
  'intelligence',
  'level1',
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

export type IntelligenceWinner = {
  id: string
  label: string
  value: string
  metricLabel: string
  metricValue: number
  secondaryLabel?: string
  secondaryValue?: number | string
  sampleSize: number
  enoughData: boolean
}

export type IntelligenceBoard = {
  id: string
  title: string
  columns: InsightTableColumn[]
  rows: { label: string; values: Record<string, string | number> }[]
  takeaway: string
}

export type AnalyticsInsights = {
  section: InsightSectionId
  kpis: InsightKpi[]
  charts: InsightChart[]
  winners?: IntelligenceWinner[]
  boards?: IntelligenceBoard[]
  actions?: string[]
  level1Stats?: Level1Stat[]
}

export function emptyAnalyticsInsights(
  section: InsightSectionId,
): AnalyticsInsights {
  if (section === 'intelligence') {
    return {
      section,
      kpis: [],
      charts: [],
      winners: [],
      boards: [],
      actions: [],
    }
  }
  if (section === 'level1') {
    return { section, kpis: [], charts: [], level1Stats: [] }
  }
  return { section, kpis: [], charts: [] }
}
