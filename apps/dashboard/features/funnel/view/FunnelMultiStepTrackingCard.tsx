"use client"

import { useMemo } from "react"
import { motion, useReducedMotion } from "motion/react"
import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { FunnelStep } from "@/features/funnel/model/funnel"
import { FunnelTrendBadge } from "@/features/funnel/view/FunnelTrendBadge"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"
import { overviewScaleIn } from "@/features/overview/view/overview-motion"

type FunnelMultiStepTrackingCardProps = {
  steps: FunnelStep[]
}

function parseStepValue(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, "")
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

export function FunnelMultiStepTrackingCard({
  steps,
}: FunnelMultiStepTrackingCardProps) {
  const reduceMotion = useReducedMotion()

  const progressByIndex = useMemo(() => {
    const values = steps.map((step) => parseStepValue(step.value))
    const max = Math.max(...values, 1)
    return values.map((value) => (value / max) * 100)
  }, [steps])

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
        <CardHeader className={overviewAnalyticCardHeaderClassName}>
          <CardTitle className={overviewSectionHeadingClassName}>
            Multi-Step Form Tracking
          </CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {steps.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground sm:px-6">
              No multi-step data for this period. Add{" "}
              <code className="text-xs">data-arohaa-step</code> and{" "}
              <code className="text-xs">data-arohaa-step-name</code> on each
              step to track step views.
            </p>
          ) : (
            steps.map((step, index) => (
              <motion.div
                key={`${step.label}-${index}`}
                initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: index * 0.06,
                  duration: 0.45,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={cn(
                  "flex min-h-0 flex-1 flex-col justify-center gap-2 px-5 py-3 sm:px-6 sm:py-4",
                  index < steps.length - 1 && "border-b border-border"
                )}
              >
                <div className="flex items-center justify-between gap-3">
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
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-neutral-900"
                    initial={
                      reduceMotion
                        ? { width: `${progressByIndex[index]}%` }
                        : { width: 0 }
                    }
                    animate={{ width: `${progressByIndex[index]}%` }}
                    transition={{
                      delay: 0.15 + index * 0.08,
                      duration: reduceMotion ? 0 : 0.55,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />
                </div>
              </motion.div>
            ))
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
