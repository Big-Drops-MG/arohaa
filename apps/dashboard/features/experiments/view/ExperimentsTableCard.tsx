"use client"

import { motion, useReducedMotion } from "motion/react"
import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { ExperimentTableHighlight } from "@/features/experiments/model/experiments"
import { ExperimentsBreakdownTableView } from "@/features/experiments/view/ExperimentsBreakdownTableView"
import type { TrafficBreakdownTable } from "@/features/traffic/model/traffic"
import { TrafficExpandableCard } from "@/features/traffic/view/TrafficExpandableCard"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"
import { overviewScaleIn } from "@/features/overview/view/overview-motion"
import {
  experimentsCardContentClassName,
  experimentsCardShellClassName,
} from "@/features/experiments/view/experiments-card-layout"

type ExperimentsTableCardProps = {
  title: string
  table: TrafficBreakdownTable
  emptyMessage?: string
  highlight?: ExperimentTableHighlight
  expandable?: boolean
  previewRowLimit?: number
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

function ExperimentsTableCardBody({
  title,
  table,
  emptyMessage,
  highlight,
}: ExperimentsTableCardProps) {
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
          experimentsCardShellClassName
        )}
      >
        <CardHeader className={overviewAnalyticCardHeaderClassName}>
          <CardTitle className={overviewSectionHeadingClassName}>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className={experimentsCardContentClassName}>
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
            <ExperimentsBreakdownTableView
              table={table}
              emptyMessage={emptyMessage}
              highlight={highlight}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function ExperimentsTableCard({
  title,
  table,
  emptyMessage = "No data for this period.",
  highlight,
  expandable = false,
  previewRowLimit,
}: ExperimentsTableCardProps) {
  const previewTable =
    previewRowLimit != null ? limitTableRows(table, previewRowLimit) : table

  const body = (
    <ExperimentsTableCardBody
      title={title}
      table={previewTable}
      emptyMessage={emptyMessage}
      highlight={highlight}
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
        <ExperimentsBreakdownTableView
          table={table}
          emptyMessage={emptyMessage}
          highlight={highlight}
        />
      }
    >
      {body}
    </TrafficExpandableCard>
  )
}
