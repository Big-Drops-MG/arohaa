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

function Level2StatCard({ stat, index }: { stat: Level2Stat; index: number }) {
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
            <div className="min-w-0">
              <p className="font-heading text-xl font-semibold tracking-tight text-foreground tabular-nums">
                {stat.value}
              </p>
              {stat.breakdown?.length ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {stat.breakdown.map((part, partIndex) => (
                    <span key={part.label}>
                      {partIndex > 0 ? (
                        <span className="text-muted-foreground/60"> · </span>
                      ) : null}
                      {part.label}{" "}
                      <span className="font-medium text-foreground tabular-nums">
                        {part.value.toLocaleString("en-US")}
                      </span>
                    </span>
                  ))}
                </p>
              ) : stat.metricLabel != null && stat.metricValue != null ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {stat.metricLabel}{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {stat.metricValue.toLocaleString("en-US")}
                  </span>
                </p>
              ) : null}
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
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy={false}
    >
      {stats.map((stat, index) => (
        <Level2StatCard key={stat.id} stat={stat} index={index} />
      ))}
    </div>
  )
}
