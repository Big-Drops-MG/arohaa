"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ChartLine, Map } from "lucide-react"
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
import type {
  OverviewKpiMetricId,
  OverviewStateMetric,
  OverviewTimeSeriesPoint,
} from "@/features/overview/model/overview"
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
  overviewSpring,
} from "@/features/overview/view/overview-motion"
import { OverviewUsaMap } from "@/features/overview/view/OverviewUsaMap"

type PerformanceViewMode = "line" | "map"

const PERFORMANCE_VIEW_OPTIONS: ReadonlyArray<{
  id: PerformanceViewMode
  label: string
  Icon: typeof ChartLine
}> = [
  { id: "line", label: "Line Graph", Icon: ChartLine },
  { id: "map", label: "Map", Icon: Map },
]

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
  metricId: OverviewKpiMetricId
  metricLabel: string
  valueSuffix?: string
  chartKey?: string
  stateMetrics?: OverviewStateMetric[]
}

export function OverviewPerformanceChart({
  points,
  metricId,
  metricLabel,
  valueSuffix,
  chartKey,
  stateMetrics = [],
}: OverviewPerformanceChartProps) {
  const reduceMotion = useReducedMotion()
  const [viewMode, setViewMode] = useState<PerformanceViewMode>("line")

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
            "flex-row flex-wrap items-center gap-2"
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <CardTitle className={overviewSectionHeadingClassName}>
              Performance over time
            </CardTitle>
            <span className="inline-flex max-w-full shrink-0 items-center rounded-full border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700">
              {metricLabel}
            </span>
          </div>

          <div
            role="group"
            aria-label="Performance view"
            className="relative ml-auto inline-grid shrink-0 grid-cols-2 gap-0.5 rounded-full border border-neutral-200/80 bg-neutral-100/90 p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]"
          >
            {PERFORMANCE_VIEW_OPTIONS.map((option) => {
              const active = viewMode === option.id
              const Icon = option.Icon
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setViewMode(option.id)}
                  className={cn(
                    "relative z-0 inline-flex h-7 items-center justify-center gap-1.5 rounded-full px-3 text-[11px] font-medium tracking-tight transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-neutral-400/40 focus-visible:outline-none",
                    active
                      ? "text-neutral-950"
                      : "text-neutral-500 hover:text-neutral-800"
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="overview-performance-view-pill"
                      className="absolute inset-0 -z-10 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/5"
                      transition={
                        reduceMotion ? { duration: 0 } : overviewSpring
                      }
                    />
                  ) : null}
                  <Icon
                    className={cn(
                      "size-3.5 shrink-0 transition-opacity",
                      active ? "opacity-100" : "opacity-70"
                    )}
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span>{option.label}</span>
                </button>
              )
            })}
          </div>
        </CardHeader>
        <CardContent
          className={cn(
            "relative flex min-h-0 flex-1 flex-col",
            overviewAnalyticCardContentPaddingClassName
          )}
        >
          <div className="relative min-h-[320px] w-full min-w-0 flex-1">
            {viewMode === "map" ? (
              <div className="absolute inset-0">
                <OverviewUsaMap
                  metricId={metricId}
                  metricLabel={metricLabel}
                  valueSuffix={valueSuffix}
                  states={stateMetrics}
                  className="h-full"
                />
              </div>
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={animationKey}
                  variants={overviewChartSwap}
                  initial={reduceMotion ? false : "initial"}
                  animate="animate"
                  exit={reduceMotion ? undefined : "exit"}
                  className="absolute inset-0"
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
                        dot={{
                          r: 3,
                          fill: "oklch(0.205 0 0)",
                          strokeWidth: 0,
                        }}
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
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
