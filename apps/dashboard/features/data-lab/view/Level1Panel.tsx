"use client"

import { Clock, Lock } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { Level1Stat } from "@/features/data-lab/model/level1"
import { emptyLevel1Stats } from "@/features/data-lab/model/level1"
import {
  overviewAnalyticCardContentPaddingClassName,
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"
import { overviewScaleIn } from "@/features/overview/view/overview-motion"

type Level1PanelProps = {
  stats: Level1Stat[]
  isLoading: boolean
  canAccess?: boolean
}

function Level1StatCard({ stat, index }: { stat: Level1Stat; index: number }) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      variants={overviewScaleIn}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      custom={index}
    >
      <Card
        className={cn(
          overviewCardPointerFocusResetClassName,
          overviewAnalyticCardShellClassName
        )}
      >
        <CardHeader className={overviewAnalyticCardHeaderClassName}>
          <CardTitle className={overviewSectionHeadingClassName}>
            {stat.label}
          </CardTitle>
        </CardHeader>
        <CardContent className={overviewAnalyticCardContentPaddingClassName}>
          {stat.enoughData ? (
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/30 text-muted-foreground shadow-xs">
                <Clock className="size-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="font-heading text-xl font-semibold tracking-tight text-foreground">
                  {stat.value}
                </p>
                {stat.metricLabel != null && stat.metricValue != null ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {stat.metricLabel}{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      {stat.metricValue.toLocaleString("en-US")}
                    </span>
                  </p>
                ) : null}
              </div>
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

function Level1Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="h-36 animate-pulse rounded-xl border border-border bg-muted/40" />
    </div>
  )
}

export function Level1Panel({
  stats,
  isLoading,
  canAccess = true,
}: Level1PanelProps) {
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
              Level 1 stats are restricted
            </p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Best-time and other Data Lab metrics are derived from lead rows
              and require approved operator access.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return <Level1Skeleton />
  }

  const displayStats = stats.length > 0 ? stats : emptyLevel1Stats()

  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy={false}
    >
      {displayStats.map((stat, index) => (
        <Level1StatCard key={stat.id} stat={stat} index={index} />
      ))}
    </div>
  )
}
