import type { OverviewFunnelChangeVariant } from "@/features/overview/model/overview"

export function funnelChangeVariant(
  changePct: number | null | undefined
): OverviewFunnelChangeVariant | undefined {
  if (changePct == null || changePct === 0) return undefined
  return changePct > 0 ? "positive" : "negative"
}

export function formatFunnelTrendChange(changePct: number | null | undefined): {
  change?: string
  changeVariant?: OverviewFunnelChangeVariant
} {
  if (changePct == null || changePct === 0) return {}

  const rounded = Math.round(changePct)
  const sign = rounded > 0 ? "+" : ""

  return {
    change: `${sign}${rounded}%`,
    changeVariant: funnelChangeVariant(changePct),
  }
}
