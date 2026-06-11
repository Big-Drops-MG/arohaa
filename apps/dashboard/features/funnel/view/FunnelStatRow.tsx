"use client"

import { TrendingDown, TrendingUp } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import type {
  FunnelChangeVariant,
  FunnelStep,
} from "@/features/funnel/model/funnel"

function changeBadgeClass(variant: FunnelChangeVariant | undefined) {
  if (variant === "positive") {
    return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/15"
  }
  if (variant === "negative") {
    return "bg-red-50 text-red-800 ring-1 ring-red-600/15"
  }
  return "bg-muted text-muted-foreground ring-1 ring-border"
}

type FunnelStatCardProps = FunnelStep

function FunnelStatCard({
  label,
  value,
  change,
  changeVariant,
}: FunnelStatCardProps) {
  const showDown = changeVariant === "negative"
  const showUp = changeVariant === "positive"

  return (
    <div className="rounded-[15px] border border-foreground/10 bg-card px-4 py-4 text-left shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {change ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
              changeBadgeClass(changeVariant)
            )}
          >
            {showDown ? (
              <TrendingDown className="size-3 shrink-0" aria-hidden />
            ) : null}
            {showUp ? (
              <TrendingUp className="size-3 shrink-0" aria-hidden />
            ) : null}
            {change}
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-heading text-xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
    </div>
  )
}

type FunnelStatRowProps = {
  steps: FunnelStep[]
}

export function FunnelStatRow({ steps }: FunnelStatRowProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {steps.map((step) => (
        <FunnelStatCard key={step.label} {...step} />
      ))}
    </div>
  )
}
