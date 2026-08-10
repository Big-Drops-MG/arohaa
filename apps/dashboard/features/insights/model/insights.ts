import type { InsightSectionId } from "@/features/insights/model/insights-section"

export type InsightChartType =
  | "line"
  | "multi-line"
  | "bar"
  | "stacked-bar"
  | "stacked-area"
  | "heatmap"
  | "horizontal-bar"
  | "table"
  | "us-map"

export type InsightKpi = {
  id: string
  label: string
  value: number
  format: "number" | "percent" | "decimal"
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

export type InsightsSectionPayload = {
  section: InsightSectionId
  kpis: InsightKpi[]
  charts: InsightChart[]
}

export function emptyInsightsSection(
  section: InsightSectionId
): InsightsSectionPayload {
  return { section, kpis: [], charts: [] }
}
