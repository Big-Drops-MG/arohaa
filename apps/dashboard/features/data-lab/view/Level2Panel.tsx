"use client"

import { Lock } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { Level2Stat } from "@/features/data-lab/model/level2"
import { Level1StatsSkeleton } from "@/features/dashboard/view/dashboard-skeletons"
import {
  overviewAnalyticCardContentPaddingClassName,
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"
import { overviewScaleIn } from "@/features/overview/view/overview-motion"

type Level2PanelProps = {
  stats: Level2Stat[]
  isLoading: boolean
  canAccess?: boolean
}

function MetricPill({
  children,
  variant = "neutral",
}: {
  children: React.ReactNode
  variant?: "neutral" | "primary" | "success" | "muted"
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        variant === "primary" &&
          "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/60",
        variant === "success" &&
          "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
        variant === "neutral" &&
          "bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200/60",
        variant === "muted" &&
          "bg-neutral-50 text-muted-foreground ring-1 ring-neutral-100"
      )}
    >
      {children}
    </span>
  )
}

function StatCardFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-auto flex min-h-12 flex-col justify-end gap-1.5 pt-2">
      {children}
    </div>
  )
}

function RatioBar({
  breakdown,
}: {
  breakdown: { label: string; value: number }[]
}) {
  const [a, b] = breakdown
  if (!a || !b) return null
  const total = a.value + b.value
  if (total === 0) return null
  const aPct = Math.round((a.value / total) * 100)
  const bPct = 100 - aPct

  return (
    <StatCardFooter>
      <div className="flex items-center justify-between gap-2 text-[11px] leading-none font-medium tabular-nums">
        <span className="inline-flex min-w-0 items-center gap-1 truncate text-emerald-700">
          <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
          {a.label} {a.value.toLocaleString()} ({aPct}%)
        </span>
        <span className="inline-flex min-w-0 items-center gap-1 truncate text-rose-600">
          <span className="size-1.5 shrink-0 rounded-full bg-rose-400" />
          {b.label} {b.value.toLocaleString()} ({bPct}%)
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-rose-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${aPct}%` }}
        />
      </div>
    </StatCardFooter>
  )
}

function Level2StatCard({ stat, index }: { stat: Level2Stat; index: number }) {
  const reduceMotion = useReducedMotion()
  const isRatio = Boolean(stat.breakdown?.length)

  return (
    <motion.div
      className="h-full"
      variants={overviewScaleIn}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      custom={index}
    >
      <Card
        className={cn(
          overviewCardPointerFocusResetClassName,
          overviewAnalyticCardShellClassName,
          "flex h-full flex-col gap-0 pt-3 pb-3"
        )}
      >
        <CardHeader
          className={cn(overviewAnalyticCardHeaderClassName, "min-h-10 pb-2!")}
        >
          <CardTitle className={overviewSectionHeadingClassName}>
            {stat.label}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col px-5 py-3 sm:px-6">
          {stat.enoughData ? (
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="font-heading text-xl font-semibold tracking-tight text-foreground">
                {stat.value}
              </p>
              {isRatio && stat.breakdown ? (
                <RatioBar breakdown={stat.breakdown} />
              ) : (
                <StatCardFooter>
                  <div className="flex flex-wrap gap-1.5">
                    {stat.metricValue != null && stat.metricValue > 0 ? (
                      <MetricPill variant="primary">
                        {stat.metricValue.toLocaleString()} submitted
                      </MetricPill>
                    ) : null}
                    {stat.submissionRate ? (
                      <MetricPill variant="success">
                        {stat.submissionRate} rate
                      </MetricPill>
                    ) : null}
                    {stat.sampleSize != null &&
                    stat.sampleSize > 0 &&
                    stat.submissionRate ? (
                      <MetricPill variant="muted">
                        {stat.sampleSize.toLocaleString()} leads
                      </MetricPill>
                    ) : null}
                  </div>
                </StatCardFooter>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not enough submission data in this range yet.
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function Level2Panel({
  stats,
  isLoading,
  canAccess = true,
}: Level2PanelProps) {
  if (!canAccess) {
    return (
      <Card
        className={cn(
          overviewCardPointerFocusResetClassName,
          overviewAnalyticCardShellClassName
        )}
      >
        <CardContent
          className={cn(
            "flex min-h-60 flex-col items-center justify-center gap-3 text-center",
            overviewAnalyticCardContentPaddingClassName
          )}
        >
          <div className="flex size-9 items-center justify-center rounded-lg border border-border/60 bg-muted/30 text-muted-foreground shadow-xs">
            <Lock className="size-4" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Level 2 stats are restricted
            </p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Level 2 Data Lab metrics are derived from lead columns and require
              approved operator access.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Level1StatsSkeleton
        count={Math.max(3, Math.min(stats.length || 6, 6))}
      />
    )
  }

  if (stats.length === 0) {
    return (
      <Card
        className={cn(
          overviewCardPointerFocusResetClassName,
          overviewAnalyticCardShellClassName
        )}
      >
        <CardContent
          className={cn(
            "flex min-h-60 flex-col items-center justify-center text-center",
            overviewAnalyticCardContentPaddingClassName
          )}
        >
          <p className="text-sm font-medium text-foreground">Level 2</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            No Level 2 columns are available for this landing page yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div
      className="grid auto-rows-fr grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy={false}
    >
      {stats.map((stat, index) => (
        <Level2StatCard key={stat.id} stat={stat} index={index} />
      ))}
    </div>
  )
}
