"use client"

import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { TrafficBreakdownTable } from "@/features/traffic/model/traffic"
import { TrafficBreakdownTableView } from "@/features/traffic/view/TrafficBreakdownTableView"
import { TrafficExpandableCard } from "@/features/traffic/view/TrafficExpandableCard"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"

type TrafficDataTableCardProps = {
  title: string
  table: TrafficBreakdownTable
  emptyMessage?: string
}

function TrafficTableCardBody({
  title,
  table,
  emptyMessage,
}: TrafficDataTableCardProps) {
  return (
    <Card
      className={cn(
        overviewCardPointerFocusResetClassName,
        overviewAnalyticCardShellClassName,
        "max-w-none pb-2"
      )}
    >
      <CardHeader className={overviewAnalyticCardHeaderClassName}>
        <CardTitle className={overviewSectionHeadingClassName}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0 pb-2">
        <TrafficBreakdownTableView table={table} emptyMessage={emptyMessage} />
      </CardContent>
    </Card>
  )
}

export function TrafficDataTableCard({
  title,
  table,
  emptyMessage,
}: TrafficDataTableCardProps) {
  const body = (
    <TrafficTableCardBody
      title={title}
      table={table}
      emptyMessage={emptyMessage}
    />
  )

  return (
    <TrafficExpandableCard
      title={title}
      expandedContent={
        <TrafficBreakdownTableView table={table} emptyMessage={emptyMessage} />
      }
    >
      {body}
    </TrafficExpandableCard>
  )
}
