"use client"

import { motion, useReducedMotion } from "motion/react"
import { cn } from "@workspace/ui/lib/utils"
import type { InsightKpi } from "@/features/insights/model/insights"
import {
  insightsFadeUp,
  insightsStaggerDelay,
} from "@/features/insights/model/insights-motion"

function formatKpi(kpi: InsightKpi): string {
  const v = Number.isFinite(kpi.value) ? kpi.value : 0
  if (kpi.format === "percent") return `${v.toFixed(1)}%`
  if (kpi.format === "decimal") return v.toFixed(2)
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 10_000) return `${(v / 1_000).toFixed(1)}K`
  if (v >= 1_000) return v.toLocaleString("en-US")
  return String(Math.round(v))
}

type InsightsKpiStripProps = {
  kpis: InsightKpi[]
  isLoading?: boolean
}

export function InsightsKpiStrip({ kpis, isLoading }: InsightsKpiStripProps) {
  const reduceMotion = useReducedMotion()
  const items = kpis.slice(0, 7)

  if (isLoading && items.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[72px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-100/80"
          />
        ))}
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {items.map((kpi, index) => (
        <motion.div
          key={kpi.id}
          variants={insightsFadeUp}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          transition={{
            delay: reduceMotion ? 0 : insightsStaggerDelay(index),
          }}
          className={cn(
            "rounded-lg border border-neutral-200 bg-white px-3 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
          )}
        >
          <p className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {kpi.label}
          </p>
          <p className="mt-1 truncate text-xl font-semibold tracking-tight text-neutral-950 tabular-nums">
            {formatKpi(kpi)}
          </p>
        </motion.div>
      ))}
    </div>
  )
}
