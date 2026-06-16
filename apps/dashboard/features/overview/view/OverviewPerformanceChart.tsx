"use client"

import { useMemo } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { OverviewTimeSeriesPoint } from "@/features/overview/model/overview"
import {
  overviewAnalyticCardContentPaddingClassName,
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"
import {
  overviewChartSwap,
  overviewScaleIn,
} from "@/features/overview/view/overview-motion"

function computeYAxisMax(points: OverviewTimeSeriesPoint[]): number {
  const max = Math.max(0, ...points.map((p) => p.value))
  if (max <= 0) return 1
  const padded = max * 1.12
  if (padded <= 12) return Math.ceil(padded * 2) / 2
  if (padded <= 100) return Math.ceil(padded / 5) * 5
  if (padded <= 500) return Math.ceil(padded / 25) * 25
  if (padded <= 2500) return Math.ceil(padded / 100) * 100
  if (padded <= 10000) return Math.ceil(padded / 500) * 500
  return Math.ceil(padded / 1000) * 1000
}

type OverviewPerformanceChartProps = {
  points: OverviewTimeSeriesPoint[]
  metricLabel: string
  valueSuffix?: string
  chartKey?: string
}

export function OverviewPerformanceChart({
  points,
  metricLabel,
  valueSuffix,
  chartKey,
}: OverviewPerformanceChartProps) {
  const reduceMotion = useReducedMotion()

  const chartMargins = useMemo(() => {
    const dense = points.length > 8
    return {
      top: 16,
      right: 20,
      left: 4,
      bottom: dense ? 48 : 28,
    } as const
  }, [points.length])

  const xAxisAngle = points.length > 8 ? -32 : 0
  const xAxisTextAnchor =
    points.length > 8 ? ("end" as const) : ("middle" as const)

  const yDomainMax = useMemo(() => computeYAxisMax(points), [points])
  const suffix = valueSuffix ?? ""
  const animationKey = chartKey ?? metricLabel

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
          overviewAnalyticCardShellClassName
        )}
      >
        <CardHeader
          className={cn(
            overviewAnalyticCardHeaderClassName,
            "flex-col items-stretch justify-center gap-1"
          )}
        >
          <CardTitle className={overviewSectionHeadingClassName}>
            Performance over time
          </CardTitle>
          <p className="text-sm font-medium text-foreground">{metricLabel}</p>
        </CardHeader>
        <CardContent
          className={cn(
            "relative flex min-h-0 flex-1 flex-col",
            overviewAnalyticCardContentPaddingClassName
          )}
        >
          <div className="relative min-h-0 w-full min-w-0 flex-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={animationKey}
                variants={overviewChartSwap}
                initial={reduceMotion ? false : "initial"}
                animate="animate"
                exit={reduceMotion ? undefined : "exit"}
                className="absolute inset-0 min-h-[320px]"
              >
                <ResponsiveContainer
                  className="outline-none **:outline-none"
                  width="100%"
                  height="100%"
                >
                  <LineChart
                    className="outline-none [&_.recharts-surface]:outline-none"
                    data={points}
                    margin={chartMargins}
                    style={{ outline: "none" }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="oklch(0.922 0 0)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: "oklch(0.556 0 0)" }}
                      tickLine={false}
                      axisLine={false}
                      angle={xAxisAngle}
                      textAnchor={xAxisTextAnchor}
                      height={points.length > 8 ? 52 : 28}
                    />
                    <YAxis
                      domain={[0, yDomainMax]}
                      tickCount={5}
                      tick={{ fontSize: 12, fill: "oklch(0.556 0 0)" }}
                      tickLine={false}
                      axisLine={false}
                      width={52}
                    />
                    <Tooltip
                      formatter={(value) => [
                        `${String(value)}${suffix}`,
                        metricLabel,
                      ]}
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid oklch(0.922 0 0)",
                        fontSize: 12,
                        boxShadow: "0 4px 12px oklch(0 0 0 / 0.08)",
                      }}
                      labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                      cursor={{
                        stroke: "oklch(0.556 0 0 / 0.35)",
                        strokeWidth: 1,
                        strokeDasharray: "4 4",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="oklch(0.205 0 0)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "oklch(0.205 0 0)", strokeWidth: 0 }}
                      activeDot={{
                        r: 5,
                        fill: "oklch(0.205 0 0)",
                        stroke: "#fff",
                        strokeWidth: 2,
                      }}
                      isAnimationActive={!reduceMotion}
                      animationDuration={reduceMotion ? 0 : 700}
                      animationEasing="ease-out"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
