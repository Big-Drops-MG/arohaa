"use client"

import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type {
  TrafficBreakdownTable,
  TrafficTableSection,
} from "@/features/traffic/model/traffic"
import { sortTrafficTableRows } from "@/features/traffic/utils/sort-traffic-table-rows"
import { trafficSectionToBreakdownTable } from "@/features/traffic/utils/traffic-section-to-table"
import { TrafficBreakdownTableView } from "@/features/traffic/view/TrafficBreakdownTableView"
import { TrafficExpandableCard } from "@/features/traffic/view/TrafficExpandableCard"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"
import {
  trafficBreakdownCardContentClassName,
  trafficBreakdownCardShellClassName,
} from "@/features/traffic/view/traffic-card-layout"

type TrafficDataTableCardProps = {
  section: TrafficTableSection
  expandable?: boolean
  previewRowLimit?: number
  sortByColumnId?: string | null
  emptyMessage?: string
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

function TrafficDataTableCardBody({
  title,
  table,
  emptyMessage,
  sortByColumnId,
}: {
  title: string
  table: TrafficBreakdownTable
  emptyMessage: string
  sortByColumnId?: string | null
}) {
  return (
    <Card
      className={cn(
        overviewCardPointerFocusResetClassName,
        overviewAnalyticCardShellClassName,
        trafficBreakdownCardShellClassName
      )}
    >
      <CardHeader className={overviewAnalyticCardHeaderClassName}>
        <CardTitle className={overviewSectionHeadingClassName}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className={trafficBreakdownCardContentClassName}>
        <TrafficBreakdownTableView
          table={table}
          emptyMessage={emptyMessage}
          sortByColumnId={sortByColumnId}
        />
      </CardContent>
    </Card>
  )
}

export function TrafficDataTableCard({
  section,
  expandable = false,
  previewRowLimit,
  sortByColumnId,
  emptyMessage = "No data for this period.",
}: TrafficDataTableCardProps) {
  const table = trafficSectionToBreakdownTable(section)
  const sortedTable = sortTrafficTableRows(table, sortByColumnId)
  const previewTable =
    previewRowLimit != null
      ? limitTableRows(sortedTable, previewRowLimit)
      : sortedTable

  const body = (
    <TrafficDataTableCardBody
      title={section.title}
      table={previewTable}
      emptyMessage={emptyMessage}
      sortByColumnId={expandable ? "" : sortByColumnId}
    />
  )

  if (!expandable) {
    return body
  }

  return (
    <TrafficExpandableCard
      title={section.title}
      className="h-full min-h-0"
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
