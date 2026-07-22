import type {
  OverviewDateRangeId,
  OverviewDateRangeOption,
} from "@/features/overview/model/overview"

export const TRAFFIC_RANGE_IDS: readonly OverviewDateRangeId[] = [
  "today",
  "yesterday",
  "this_week",
  "7d",
  "last_week",
  "this_month",
  "last_month",
  "custom",
] as const

export const TRAFFIC_DATE_RANGE_OPTIONS: OverviewDateRangeOption[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this_week", label: "This Week" },
  { id: "7d", label: "Last 7 Days" },
  { id: "last_week", label: "Last Week" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "custom", label: "Custom Range" },
]

export const DEFAULT_TRAFFIC_RANGE_ID: OverviewDateRangeId = "7d"

export type DashboardCustomRange = {
  from: string
  to: string
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export function isTrafficRangeId(value: string): value is OverviewDateRangeId {
  return (TRAFFIC_RANGE_IDS as readonly string[]).includes(value)
}

export function isDashboardDateKey(value: string): boolean {
  return DATE_KEY_RE.test(value)
}

export function parseTrafficRangeId(
  value: string | null | undefined
): OverviewDateRangeId {
  const trimmed = value?.trim()
  if (trimmed && isTrafficRangeId(trimmed)) return trimmed
  return DEFAULT_TRAFFIC_RANGE_ID
}

export function parseDashboardCustomRange(
  from?: string | null,
  to?: string | null
): DashboardCustomRange | undefined {
  const f = from?.trim()
  const t = to?.trim()
  if (!f || !t) return undefined
  if (!isDashboardDateKey(f) || !isDashboardDateKey(t)) return undefined
  if (f > t) return undefined
  return { from: f, to: t }
}

export function trafficRangeLabel(
  rangeId: OverviewDateRangeId,
  custom?: DashboardCustomRange | null
): string {
  if (rangeId === "custom" && custom) {
    return formatCustomRangeLabel(custom.from, custom.to)
  }
  return (
    TRAFFIC_DATE_RANGE_OPTIONS.find((opt) => opt.id === rangeId)?.label ??
    "Last 7 Days"
  )
}

export function formatCustomRangeLabel(from: string, to: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
  const fromDate = new Date(`${from}T12:00:00.000Z`)
  const toDate = new Date(`${to}T12:00:00.000Z`)
  if (from === to) return fmt.format(fromDate)
  const short = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
  if (from.slice(0, 4) === to.slice(0, 4)) {
    return `${short.format(fromDate)} – ${fmt.format(toDate)}`
  }
  return `${fmt.format(fromDate)} – ${fmt.format(toDate)}`
}
