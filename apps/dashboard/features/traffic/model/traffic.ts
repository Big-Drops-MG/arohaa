import type { OverviewDateRangeId } from "@/features/overview/model/overview"

export type TrafficTableColumn = {
  id: string
  label: string
  align?: "left" | "right"
}

export type TrafficTableRow = Record<string, string>

export type TrafficBreakdownTable = {
  columns: TrafficTableColumn[]
  rows: TrafficTableRow[]
}

export type TrafficSourcesData = {
  referrers: TrafficBreakdownTable
  utmParameters: TrafficBreakdownTable
}

export type TrafficTabTables = {
  byTime: TrafficBreakdownTable
  byLocation: TrafficBreakdownTable
  byDevice: TrafficBreakdownTable
  sources: TrafficSourcesData
  topPages: TrafficBreakdownTable
}

export type TrafficTablesByDateRange = Record<
  OverviewDateRangeId,
  TrafficTabTables
>
