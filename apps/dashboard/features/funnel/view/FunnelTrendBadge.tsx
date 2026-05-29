import { TrendingDown, TrendingUp } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import type { OverviewFunnelChangeVariant } from "@/features/overview/model/overview"

function badgeClass(variant: OverviewFunnelChangeVariant | undefined) {
  if (variant === "positive") {
    return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/15"
  }
  if (variant === "negative") {
    return "bg-red-50 text-red-800 ring-1 ring-red-600/15"
  }
  return "bg-muted text-muted-foreground ring-1 ring-border"
}

type FunnelTrendBadgeProps = {
  change: string
  variant?: OverviewFunnelChangeVariant
}

export function FunnelTrendBadge({ change, variant }: FunnelTrendBadgeProps) {
  const Icon = variant === "positive" ? TrendingUp : TrendingDown

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
        badgeClass(variant)
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {change}
    </span>
  )
}
