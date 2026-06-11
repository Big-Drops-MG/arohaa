"use client"

import type { ReactNode } from "react"
import { AlertTriangle, Bell, CircleAlert } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import type { OverviewAlertSeverity } from "@/features/overview/model/overview"
import type { AlertsSeverityFilterValue } from "@/features/alerts/utils/alert-severity-filter"

type AlertsSeverityFilterProps = {
  counts: Record<OverviewAlertSeverity, number>
  value: AlertsSeverityFilterValue
  onChange: (value: AlertsSeverityFilterValue) => void
}

const filterButtonClassName =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-transparent px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"

const filterButtonActiveClassName = "border-border bg-muted text-foreground"

type FilterButtonProps = {
  label: string
  count: number
  active: boolean
  onClick: () => void
  icon: ReactNode
}

function FilterButton({
  label,
  count,
  active,
  onClick,
  icon,
}: FilterButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label}, ${count}`}
      className={cn(
        filterButtonClassName,
        active && filterButtonActiveClassName
      )}
    >
      {icon}
      <span className="tabular-nums">{count}</span>
    </button>
  )
}

export function AlertsSeverityFilter({
  counts,
  value,
  onChange,
}: AlertsSeverityFilterProps) {
  function toggleFilter(severity: OverviewAlertSeverity) {
    onChange(value === severity ? "all" : severity)
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <FilterButton
        label="Warnings"
        count={counts.warning}
        active={value === "warning"}
        onClick={() => toggleFilter("warning")}
        icon={
          <AlertTriangle
            className="size-3.5 shrink-0 text-orange-600"
            aria-hidden
          />
        }
      />
      <FilterButton
        label="Alerts"
        count={counts.alert}
        active={value === "alert"}
        onClick={() => toggleFilter("alert")}
        icon={<Bell className="size-3.5 shrink-0 text-sky-600" aria-hidden />}
      />
      <FilterButton
        label="Errors"
        count={counts.error}
        active={value === "error"}
        onClick={() => toggleFilter("error")}
        icon={
          <CircleAlert className="size-3.5 shrink-0 text-red-600" aria-hidden />
        }
      />
    </div>
  )
}
