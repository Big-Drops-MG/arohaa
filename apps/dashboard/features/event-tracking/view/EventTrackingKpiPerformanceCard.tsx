"use client"

import { useMemo } from "react"
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

type EventTrackingKpiPerformanceCardProps = {
  formType: OverviewLandingFormType
  segments: EventTrackingKpiSegment[]
  emptyMessage?: string
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

function formatPercent(value: number, total: number): string {
  if (total <= 0) return "0%"
  return `${Math.round((value / total) * 100)}%`
}

export function EventTrackingKpiPerformanceCard({
  formType,
  segments,
  emptyMessage = "No KPI data for this period.",
}: EventTrackingKpiPerformanceCardProps) {
  const chartData = useMemo(() => {
    const order = eventTrackingKpiSegmentOrder(formType)
    const byId = new Map(segments.map((segment) => [segment.id, segment.value]))

    return order.map((id) => ({
      id,
      name: eventTrackingKpiSegmentLabel(formType, id),
      value: Math.max(0, byId.get(id) ?? 0),
      color: EVENT_TRACKING_KPI_SEGMENT_COLORS[id],
    }))
  }, [formType, segments])

  const activeSlices = chartData.filter((slice) => slice.value > 0)
  const total = activeSlices.reduce((sum, slice) => sum + slice.value, 0)

  return (
    <Card
      className={cn(
        overviewCardPointerFocusResetClassName,
        overviewAnalyticCardShellClassName,
        overviewRechartsPointerFocusResetClassName,
        "max-w-none"
      )}
    >
      <CardHeader className={overviewAnalyticCardHeaderClassName}>
        <CardTitle className={overviewSectionHeadingClassName}>
          KPI Performance
        </CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          "flex min-h-[320px] flex-col",
          overviewAnalyticCardContentPaddingClassName
        )}
      >
        {activeSlices.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          <>
            <div
              className="relative min-h-[260px] w-full outline-none"
              onMouseDown={(event) => event.preventDefault()}
            >
              <div className="absolute inset-0 min-h-[260px] outline-none">
                <ResponsiveContainer
                  className="outline-none **:outline-none"
                  width="100%"
                  height="100%"
                >
                  <PieChart
                    key={activeSlices
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
        )}
      </CardContent>
    </Card>
  )
}
