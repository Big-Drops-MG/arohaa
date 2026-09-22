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
  "all_time",
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
  { id: "all_time", label: "All Time" },
  { id: "custom", label: "Custom Range" },
]

export const DEFAULT_TRAFFIC_RANGE_ID: OverviewDateRangeId = "7d"

export type DashboardCustomRange = {
  from: string
  to: string
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export const MAX_DASHBOARD_CUSTOM_SPAN_DAYS = 731

const DAY_MS = 24 * 60 * 60 * 1000

function customRangeSpanDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`)
  const end = Date.parse(`${to}T00:00:00.000Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.floor((end - start) / DAY_MS) + 1
}

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
  if (customRangeSpanDays(f, t) > MAX_DASHBOARD_CUSTOM_SPAN_DAYS)
    return undefined
  return { from: f, to: t }
}

export function trafficRangeLabel(
  rangeId: OverviewDateRangeId,
  custom?: DashboardCustomRange | null
): string {
  if (rangeId === "custom" && custom) {
    return formatCustomRangeLabel(custom.from, custom.to)
  }
  if (rangeId === "all_time") return "All Time"
  return (
    TRAFFIC_DATE_RANGE_OPTIONS.find((opt) => opt.id === rangeId)?.label ??
    "Last 7 Days"
  )
}

export function formatCustomRangeLabel(from: string, to: string): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ] as const

  const formatDay = (isoDate: string, withYear: boolean): string => {
    const parts = isoDate.split("-")
    const year = Number(parts[0])
    const month = Number(parts[1])
    const day = Number(parts[2])
    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day) ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return isoDate
    }
    const monthLabel = months[month - 1]
    return withYear ? `${monthLabel} ${day}, ${year}` : `${monthLabel} ${day}`
  }

  if (from === to) return formatDay(from, true)
  if (from.slice(0, 4) === to.slice(0, 4)) {
    return `${formatDay(from, false)} – ${formatDay(to, true)}`
  }
  return `${formatDay(from, true)} – ${formatDay(to, true)}`
}
