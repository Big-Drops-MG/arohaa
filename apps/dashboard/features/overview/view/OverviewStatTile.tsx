"use client"

import type { LucideIcon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { cn } from "@workspace/ui/lib/utils"
import { overviewMetricSubtitleClassName } from "@/features/overview/view/overview-card-density"

type OverviewStatTileProps = {
  label: string
  value: string
  icon: LucideIcon
  index: number
}

export function OverviewStatTile({
  label,
  value,
  icon: Icon,
  index,
}: OverviewStatTileProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.06,
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-3"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-xs">
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 truncate font-heading text-lg font-semibold tabular-nums",
            overviewMetricSubtitleClassName
          )}
        >
          {value}
        </p>
      </div>
    </motion.div>
  )
}
