import type {
  OverviewDateRangeId,
  OverviewDateRangeOption,
} from "@/features/overview/model/overview"

export const TRAFFIC_RANGE_IDS: readonly OverviewDateRangeId[] = [
  "24h",
  "7d",
  "30d",
  "3m",
  "12m",
  "24m",
] as const

export const TRAFFIC_DATE_RANGE_OPTIONS: OverviewDateRangeOption[] = [
  { id: "24h", label: "Last 24 hours" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "3m", label: "Last 3 months" },
  { id: "12m", label: "Last 12 months" },
  { id: "24m", label: "Last 24 months" },
]

export const DEFAULT_TRAFFIC_RANGE_ID: OverviewDateRangeId = "7d"

export function isTrafficRangeId(value: string): value is OverviewDateRangeId {
  return (TRAFFIC_RANGE_IDS as readonly string[]).includes(value)
}

export function parseTrafficRangeId(
  value: string | null | undefined
): OverviewDateRangeId {
  const trimmed = value?.trim()
  if (trimmed && isTrafficRangeId(trimmed)) return trimmed
  return DEFAULT_TRAFFIC_RANGE_ID
}

export function trafficRangeLabel(rangeId: OverviewDateRangeId): string {
  return (
    TRAFFIC_DATE_RANGE_OPTIONS.find((opt) => opt.id === rangeId)?.label ??
    "Last 7 days"
  )
}
