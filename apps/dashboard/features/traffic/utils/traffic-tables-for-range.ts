import { defaultTrafficTabTables } from "@/features/traffic/controller/traffic-default-payload"
import type { TrafficTabTables } from "@/features/traffic/model/traffic"
import type {
  OverviewDashboardData,
  OverviewDateRangeId,
} from "@/features/overview/model/overview"

function fmtCount(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 10_000) return `${(v / 1_000).toFixed(1)}K`
  if (v >= 1_000) return v.toLocaleString("en-US")
  return String(v)
}

function mergeByTimeFromSeries(
  tables: TrafficTabTables,
  data: OverviewDashboardData,
  rangeId: OverviewDateRangeId
): TrafficTabTables {
  if (tables.byTime.rows.length > 0) return tables

  const series = data.kpiSeriesByDateRange?.[rangeId]?.visitors
  if (!series?.length) return tables

  return {
    ...tables,
    byTime: {
      ...tables.byTime,
      rows: series.map((point) => ({
        date: point.label,
        visitors: fmtCount(point.value),
        sessions: "0",
        formSubmitted: "0",
      })),
    },
  }
}

export function trafficTablesForDateRange(
  data: OverviewDashboardData,
  rangeId: OverviewDateRangeId
): TrafficTabTables {
  const tables =
    data.trafficTablesByDateRange[rangeId] ??
    defaultTrafficTabTables(data.formType)

  return mergeByTimeFromSeries(tables, data, rangeId)
}
