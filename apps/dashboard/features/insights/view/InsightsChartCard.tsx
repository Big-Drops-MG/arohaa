"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import {
  overviewAnalyticCardContentPaddingClassName,
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"
import {
  insightsFadeUp,
  insightsStaggerDelay,
} from "@/features/insights/model/insights-motion"

type InsightsChartCardProps = {
  title: string
  helper?: string
  fullWidth?: boolean
  index?: number
  children: ReactNode
  className?: string
}

export function InsightsChartCard({
  title,
  helper,
  fullWidth,
  index = 0,
  children,
  className,
}: InsightsChartCardProps) {
  const reduceMotion = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(reduceMotion === true)

  useEffect(() => {
    if (reduceMotion) {
      setVisible(true)
      return
    }
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: "40px", threshold: 0.08 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reduceMotion])

  return (
    <motion.div
      ref={ref}
      className={cn(fullWidth ? "col-span-full" : undefined, className)}
      variants={insightsFadeUp}
      initial={reduceMotion ? false : "hidden"}
      animate={visible ? "visible" : "hidden"}
      transition={{ delay: reduceMotion ? 0 : insightsStaggerDelay(index) }}
    >
      <Card
        className={cn(
          "flex h-full min-h-0 flex-col overflow-hidden",
          overviewCardPointerFocusResetClassName,
          overviewAnalyticCardShellClassName
        )}
      >
        <CardHeader className={overviewAnalyticCardHeaderClassName}>
          <div className="min-w-0">
            <CardTitle className={overviewSectionHeadingClassName}>
              {title}
            </CardTitle>
            {helper ? (
              <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
            ) : null}
          </div>
        </CardHeader>
        <CardContent
          className={cn(
            "relative flex min-h-0 flex-1 flex-col",
            overviewAnalyticCardContentPaddingClassName
          )}
        >
          {children}
        </CardContent>
      </Card>
    </motion.div>
  )
}
