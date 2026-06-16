"use client"

import { useMemo } from "react"
import { motion, useReducedMotion } from "motion/react"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { EventTrackingKpiSegment } from "@/features/event-tracking/model/event-tracking"
import {
  EVENT_TRACKING_KPI_SEGMENT_COLORS,
  eventTrackingKpiSegmentLabel,
  eventTrackingKpiSegmentOrder,
} from "@/features/event-tracking/utils/event-tracking-segment-labels"
import type { OverviewLandingFormType } from "@/features/overview/model/overview"
import {
  overviewAnalyticCardContentPaddingClassName,
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import {
  overviewCardPointerFocusResetClassName,
  overviewRechartsPointerFocusResetClassName,
} from "@/features/overview/view/overview-focus-styles"
import { overviewScaleIn } from "@/features/overview/view/overview-motion"
import { TrafficExpandableCard } from "@/features/traffic/view/TrafficExpandableCard"
import { eventTrackingDetailCardShellClassName } from "@/features/event-tracking/view/event-tracking-card-layout"

type EventTrackingKpiPerformanceCardProps = {
  formType: OverviewLandingFormType
  segments: EventTrackingKpiSegment[]
  emptyMessage?: string
  expandable?: boolean
}

type ChartSlice = {
  id: string
  name: string
  value: number
  color: string
}

type EventTrackingPieTooltipProps = {
  active?: boolean
  payload?: ReadonlyArray<{
    payload?: ChartSlice
    value?: unknown
  }>
  total: number
}

function formatPercent(value: number, total: number): string {
  if (total <= 0) return "0%"
  return `${Math.round((value / total) * 100)}%`
}

function EventTrackingPieTooltip({
  active,
  payload,
  total,
}: EventTrackingPieTooltipProps) {
  if (!active || !payload?.length) return null

  const slice = payload[0]?.payload
  const value = Number(payload[0]?.value ?? 0)
  if (!slice) return null

  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-foreground">{slice.name}</p>
      <p className="mt-0.5 text-foreground tabular-nums">
        {value.toLocaleString("en-US")} ({formatPercent(value, total)})
      </p>
    </div>
  )
}

function EventTrackingPieChartBody({
  chartData,
  activeSlices,
  total,
  emptyMessage,
  chartHeightClassName = "min-h-[260px]",
}: {
  chartData: ChartSlice[]
  activeSlices: ChartSlice[]
  total: number
  emptyMessage: string
  chartHeightClassName?: string
}) {
  if (activeSlices.length === 0) {
    return (
      <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    )
  }

  return (
    <>
      <div
        className={cn("relative w-full outline-none", chartHeightClassName)}
        onMouseDown={(event) => event.preventDefault()}
      >
        <div
          className={cn("absolute inset-0 outline-none", chartHeightClassName)}
        >
          <ResponsiveContainer
            className="outline-none **:outline-none"
            width="100%"
            height="100%"
          >
            <PieChart
              key={chartData
                .map((slice) => `${slice.id}:${slice.value}`)
                .join("|")}
              className="outline-none [&_.recharts-surface]:outline-none"
              style={{ outline: "none" }}
            >
              <Pie
                data={activeSlices}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="80%"
                stroke="none"
                isAnimationActive={false}
              >
                {activeSlices.map((slice) => (
                  <Cell key={slice.id} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => (
                  <EventTrackingPieTooltip
                    active={active}
                    payload={payload}
                    total={total}
                  />
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <ul className="mt-2 flex flex-wrap justify-center gap-x-6 gap-y-2">
        {activeSlices.map((slice) => (
          <li
            key={slice.id}
            className="flex items-center gap-2 text-xs text-foreground"
          >
            <span
              className="size-3 shrink-0 rounded-sm"
              style={{ backgroundColor: slice.color }}
              aria-hidden
            />
            <span>
              {slice.name}{" "}
              <span className="text-muted-foreground tabular-nums">
                {formatPercent(slice.value, total)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

function useChartData(
  formType: OverviewLandingFormType,
  segments: EventTrackingKpiSegment[]
) {
  return useMemo(() => {
    const order = eventTrackingKpiSegmentOrder(formType)
    const byId = new Map(segments.map((segment) => [segment.id, segment.value]))

    const chartData = order.map((id) => ({
      id,
      name: eventTrackingKpiSegmentLabel(formType, id),
      value: Math.max(0, byId.get(id) ?? 0),
      color: EVENT_TRACKING_KPI_SEGMENT_COLORS[id],
    }))

    const activeSlices = chartData.filter((slice) => slice.value > 0)
    const total = activeSlices.reduce((sum, slice) => sum + slice.value, 0)

    return { chartData, activeSlices, total }
  }, [formType, segments])
}

function EventTrackingKpiPerformanceCardBody({
  formType,
  segments,
  emptyMessage = "No KPI data for this period.",
  chartHeightClassName,
}: EventTrackingKpiPerformanceCardProps & {
  chartHeightClassName?: string
}) {
  const reduceMotion = useReducedMotion()
  const { chartData, activeSlices, total } = useChartData(formType, segments)

  return (
    <motion.div
      variants={overviewScaleIn}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      className="h-full min-h-0"
    >
      <Card
        className={cn(
          "flex h-full min-h-0 flex-col overflow-hidden",
          overviewCardPointerFocusResetClassName,
          overviewAnalyticCardShellClassName,
          overviewRechartsPointerFocusResetClassName,
          eventTrackingDetailCardShellClassName
        )}
      >
        <CardHeader className={overviewAnalyticCardHeaderClassName}>
          <CardTitle className={overviewSectionHeadingClassName}>
            KPI Performance
          </CardTitle>
        </CardHeader>
        <CardContent
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            overviewAnalyticCardContentPaddingClassName
          )}
        >
          <EventTrackingPieChartBody
            chartData={chartData}
            activeSlices={activeSlices}
            total={total}
            emptyMessage={emptyMessage}
            chartHeightClassName={chartHeightClassName}
          />
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function EventTrackingKpiPerformanceCard({
  formType,
  segments,
  emptyMessage = "No KPI data for this period.",
  expandable = false,
}: EventTrackingKpiPerformanceCardProps) {
  const { chartData, activeSlices, total } = useChartData(formType, segments)

  const body = (
    <EventTrackingKpiPerformanceCardBody
      formType={formType}
      segments={segments}
      emptyMessage={emptyMessage}
    />
  )

  if (!expandable) {
    return body
  }

  return (
    <TrafficExpandableCard
      title="KPI Performance"
      className="h-full min-h-0"
      dialogClassName="max-w-4xl"
      expandedContent={
        <div className="p-6">
          <EventTrackingPieChartBody
            chartData={chartData}
            activeSlices={activeSlices}
            total={total}
            emptyMessage={emptyMessage}
            chartHeightClassName="min-h-[360px]"
          />
        </div>
      }
    >
      {body}
    </TrafficExpandableCard>
  )
}
