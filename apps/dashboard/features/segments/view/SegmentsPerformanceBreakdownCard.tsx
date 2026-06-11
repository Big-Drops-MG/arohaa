"use client"

import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { TrafficBreakdownTable } from "@/features/traffic/model/traffic"
import { sortTrafficTableRows } from "@/features/traffic/utils/sort-traffic-table-rows"
import { TrafficBreakdownTableView } from "@/features/traffic/view/TrafficBreakdownTableView"
import { TrafficExpandableCard } from "@/features/traffic/view/TrafficExpandableCard"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"
import {
  segmentsPerformanceCardContentClassName,
  segmentsPerformanceCardShellClassName,
  type SegmentsPerformanceCardSize,
} from "@/features/segments/view/segments-performance-card-layout"

type SegmentsPerformanceBreakdownCardProps = {
  title: string
  table: TrafficBreakdownTable
  emptyMessage?: string
  sortByColumnId?: string | null
  expandable?: boolean
  previewRowLimit?: number
  size?: SegmentsPerformanceCardSize
}

function limitTableRows(
  table: TrafficBreakdownTable,
  limit: number
): TrafficBreakdownTable {
  return {
    ...table,
    rows: table.rows.slice(0, limit),
  }
}

function SegmentsPerformanceBreakdownCardBody({
  title,
  table,
  emptyMessage,
  sortByColumnId,
  size = "tall",
}: SegmentsPerformanceBreakdownCardProps) {
  return (
    <Card
      className={cn(
        overviewCardPointerFocusResetClassName,
        overviewAnalyticCardShellClassName,
        segmentsPerformanceCardShellClassName
      )}
    >
      <CardHeader className={overviewAnalyticCardHeaderClassName}>
        <CardTitle className={overviewSectionHeadingClassName}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className={segmentsPerformanceCardContentClassName(size)}>
        <TrafficBreakdownTableView
          table={table}
          emptyMessage={emptyMessage}
          sortByColumnId={sortByColumnId}
        />
      </CardContent>
    </Card>
  )
}

export function SegmentsPerformanceBreakdownCard({
  title,
  table,
  emptyMessage = "No data for this period.",
  sortByColumnId = "visitors",
  expandable = false,
  previewRowLimit,
  size = "tall",
}: SegmentsPerformanceBreakdownCardProps) {
  const sortedTable = sortTrafficTableRows(table, sortByColumnId)
  const previewTable =
    previewRowLimit != null
      ? limitTableRows(sortedTable, previewRowLimit)
      : sortedTable

  const body = (
    <SegmentsPerformanceBreakdownCardBody
      title={title}
      table={previewTable}
      emptyMessage={emptyMessage}
      sortByColumnId=""
      size={size}
    />
  )

  if (!expandable) {
    return body
  }

  return (
    <TrafficExpandableCard
      title={title}
      className="h-full"
      expandedContent={
        <TrafficBreakdownTableView
          table={table}
          emptyMessage={emptyMessage}
          sortByColumnId={sortByColumnId}
        />
      }
    >
      {body}
    </TrafficExpandableCard>
  )
}
