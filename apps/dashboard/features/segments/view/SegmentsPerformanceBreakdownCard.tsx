"use client"

import { motion, useReducedMotion } from "motion/react"
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
import { overviewScaleIn } from "@/features/overview/view/overview-motion"
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
  size = "compact",
}: SegmentsPerformanceBreakdownCardProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      variants={overviewScaleIn}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      className="h-full min-h-0"
    >
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
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
            <TrafficBreakdownTableView
              table={table}
              emptyMessage={emptyMessage}
              sortByColumnId={sortByColumnId}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function SegmentsPerformanceBreakdownCard({
  title,
  table,
  emptyMessage = "No data for this period.",
  sortByColumnId = "visitors",
  expandable = false,
  previewRowLimit,
  size = "compact",
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
