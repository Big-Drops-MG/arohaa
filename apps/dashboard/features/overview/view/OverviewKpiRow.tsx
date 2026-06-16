"use client"

import { motion, useReducedMotion } from "motion/react"
import { cn } from "@workspace/ui/lib/utils"
import type {
  OverviewKpi,
  OverviewKpiMetricId,
} from "@/features/overview/model/overview"
import {
  overviewSpring,
  overviewStaggerContainer,
  overviewStaggerItem,
} from "@/features/overview/view/overview-motion"

type OverviewKpiRowProps = {
  kpis: OverviewKpi[]
  activeKpiId: OverviewKpiMetricId
  onKpiSelect: (id: OverviewKpiMetricId) => void
}

export function OverviewKpiRow({
  kpis,
  activeKpiId,
  onKpiSelect,
}: OverviewKpiRowProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      variants={overviewStaggerContainer}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
    >
      {kpis.map((kpi) => {
        const active = kpi.id === activeKpiId
        return (
          <motion.button
            key={kpi.id}
            type="button"
            variants={overviewStaggerItem}
            onClick={() => onKpiSelect(kpi.id)}
            aria-pressed={active}
            whileHover={
              reduceMotion || active
                ? undefined
                : { y: -2, transition: overviewSpring }
            }
            whileTap={reduceMotion ? undefined : { scale: 0.985 }}
            className={cn(
              "relative overflow-hidden rounded-2xl border px-4 py-4 text-left shadow-xs transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              active
                ? "border-neutral-950 shadow-md"
                : "border-foreground/10 bg-card hover:border-foreground/20 hover:shadow-sm"
            )}
          >
            {active ? (
              <motion.div
                layoutId="overview-kpi-active"
                className="absolute inset-0 bg-neutral-950"
                transition={reduceMotion ? { duration: 0 } : overviewSpring}
              />
            ) : null}
            <div className="relative z-10">
              <p
                className={cn(
                  "text-xs leading-snug font-medium",
                  active ? "text-white/75" : "text-muted-foreground"
                )}
              >
                {kpi.label}
              </p>
              <motion.p
                key={kpi.value}
                initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "mt-2 font-heading text-xl font-semibold tracking-tight tabular-nums",
                  active ? "text-white" : "text-foreground"
                )}
              >
                {kpi.value}
              </motion.p>
            </div>
          </motion.button>
        )
      })}
    </motion.div>
  )
}
