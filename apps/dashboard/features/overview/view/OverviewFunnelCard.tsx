"use client"

import { motion, useReducedMotion } from "motion/react"
import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { FunnelTrendBadge } from "@/features/funnel/view/FunnelTrendBadge"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"
import { overviewScaleIn } from "@/features/overview/view/overview-motion"
import type { OverviewFunnelStep } from "@/features/overview/model/overview"

type OverviewFunnelCardProps = {
  steps: OverviewFunnelStep[]
}

export function OverviewFunnelCard({ steps }: OverviewFunnelCardProps) {
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
          "flex h-full flex-col"
        )}
      >
        <CardHeader className={overviewAnalyticCardHeaderClassName}>
          <CardTitle className={overviewSectionHeadingClassName}>
            Funnel
          </CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {steps.map((step, index) => (
            <motion.div
              key={step.label}
              initial={reduceMotion ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: index * 0.06,
                duration: 0.45,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={cn(
                "flex flex-1 items-center justify-between gap-3 px-5 py-3 sm:px-6 sm:py-4",
                index < steps.length - 1 && "border-b border-border"
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {step.label}
                  </p>
                  <p className="mt-0.5 font-heading text-lg font-semibold text-foreground tabular-nums">
                    {step.value}
                  </p>
                </div>
              </div>
              {step.change ? (
                <FunnelTrendBadge
                  change={step.change}
                  variant={step.changeVariant}
                />
              ) : null}
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  )
}
