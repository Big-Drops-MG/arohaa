import { TrendingDown, TrendingUp } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import type { OverviewFunnelChangeVariant } from "@/features/overview/model/overview"

function badgeClass(variant: OverviewFunnelChangeVariant | undefined) {
  if (variant === "positive") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
  }
  if (variant === "negative") {
    return "bg-red-50 text-red-700 ring-1 ring-red-600/20"
  }
  return "bg-muted text-muted-foreground ring-1 ring-border"
}

type FunnelTrendBadgeProps = {
  change: string
  variant?: OverviewFunnelChangeVariant
  className?: string
}

export function FunnelTrendBadge({
  change,
  variant,
  className,
}: FunnelTrendBadgeProps) {
  const Icon = variant === "positive" ? TrendingUp : TrendingDown

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] leading-none font-semibold tabular-nums",
        badgeClass(variant),
        className
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {change}
    </span>
  )
}
