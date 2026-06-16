"use client"

import { CalendarDays } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { cn } from "@workspace/ui/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import type {
  OverviewDateRangeId,
  OverviewDateRangeOption,
} from "@/features/overview/model/overview"
import {
  overviewSelectContentClassName,
  overviewSelectItemClassName,
  overviewSelectTriggerClassName,
} from "@/features/overview/view/overview-select-styles"

type OverviewHeaderProps = {
  title: string
  dateRangeOptions: OverviewDateRangeOption[]
  dateRangeId: OverviewDateRangeId
  onDateRangeChange: (id: OverviewDateRangeId) => void
}

export function OverviewHeader({
  title,
  dateRangeOptions,
  dateRangeId,
  onDateRangeChange,
}: OverviewHeaderProps) {
  const reduceMotion = useReducedMotion()
  const selectedLabel =
    dateRangeOptions.find((opt) => opt.id === dateRangeId)?.label ??
    "Last 7 days"

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">
          Landing page performance at a glance
        </p>
      </div>
      <motion.div
        whileHover={reduceMotion ? undefined : { scale: 1.02 }}
        whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      >
        <Select
          value={dateRangeId}
          onValueChange={(v) => onDateRangeChange(v as OverviewDateRangeId)}
        >
          <SelectTrigger
            size="sm"
            className={cn(
              overviewSelectTriggerClassName,
              "h-9 w-full gap-2 sm:w-44"
            )}
            aria-label="Date range"
          >
            <CalendarDays className="size-3.5 shrink-0 text-white/70" />
            <SelectValue placeholder="Date range">{selectedLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent
            align="end"
            position="popper"
            side="bottom"
            sideOffset={6}
            avoidCollisions={false}
            className={overviewSelectContentClassName}
          >
            {dateRangeOptions.map((opt) => (
              <SelectItem
                key={opt.id}
                value={opt.id}
                className={overviewSelectItemClassName}
              >
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>
    </div>
  )
}
