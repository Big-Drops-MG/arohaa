import type { Level1Stat } from "@/features/data-lab/model/level1"
import type { InsightSectionId } from "@/features/insights/model/insights-section"
import type {
  IntelligenceBoard,
  IntelligenceWinner,
} from "@/features/data-lab/model/intelligence"

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
  winners?: IntelligenceWinner[]
  boards?: IntelligenceBoard[]
  actions?: string[]
  level1Stats?: Level1Stat[]
}

export function emptyInsightsSection(
  section: InsightSectionId
): InsightsSectionPayload {
  if (section === "intelligence") {
    return {
      section,
      kpis: [],
      charts: [],
      winners: [],
      boards: [],
      actions: [],
    }
  }
  if (section === "level1") {
    return { section, kpis: [], charts: [], level1Stats: [] }
  }
  return { section, kpis: [], charts: [] }
}
