"use client"

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"
import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { EventTrackingPieSegment } from "@/features/event-tracking/model/event-tracking"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"

type EventTrackingKpiPieChartProps = {
  segments: EventTrackingPieSegment[]
}

type PieLabelProps = {
  cx?: number
  cy?: number
  midAngle?: number
  outerRadius?: number
  name?: string
  value?: number
}

function renderPieLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  outerRadius = 0,
  name = "",
  value = 0,
}: PieLabelProps) {
  const RADIAN = Math.PI / 180
  const radius = outerRadius + 28
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  const anchor = x > cx ? "start" : "end"

  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="central"
      className="fill-foreground text-xs"
    >
      {`${name}: ${value}%`}
    </text>
  )
}

export function EventTrackingKpiPieChart({
  segments,
}: EventTrackingKpiPieChartProps) {
  return (
    <Card
      className={cn(
        overviewCardPointerFocusResetClassName,
        overviewAnalyticCardShellClassName,
        "flex max-w-none flex-col gap-0 py-0"
      )}
    >
      <CardHeader className={overviewAnalyticCardHeaderClassName}>
        <CardTitle className={overviewSectionHeadingClassName}>
          KPI performance
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col px-5 pt-2 pb-6 sm:px-6">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 8, right: 48, bottom: 8, left: 48 }}>
              <Pie
                data={segments}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={88}
                paddingAngle={0}
                stroke="#ffffff"
                strokeWidth={2}
                labelLine={{
                  stroke: "#d1d5db",
                  strokeWidth: 1,
                }}
                label={renderPieLabel}
              >
                {segments.map((segment) => (
                  <Cell key={segment.name} fill={segment.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-6">
          {segments.map((segment) => (
            <div
              key={segment.name}
              className="flex items-center gap-2 text-sm text-foreground"
            >
              <span
                className="size-3 shrink-0 rounded-sm"
                style={{ backgroundColor: segment.color }}
                aria-hidden
              />
              {segment.name}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
