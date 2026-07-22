import type {
  OverviewDateRangeId,
  OverviewTimeSeriesPoint,
} from "@/features/overview/model/overview"
import type { DashboardCustomRange } from "@/features/traffic/model/traffic-range"
import {
  addDashboardDays,
  createDashboardDateTimeFormatter,
  dashboardZonedTimeToUtcMs,
  getDashboardZonedParts,
  startOfDashboardDay,
} from "@/lib/datetime"

const shortMonthDay = createDashboardDateTimeFormatter({
  month: "short",
  day: "numeric",
})

const hour12 = createDashboardDateTimeFormatter({
  hour: "numeric",
  hour12: true,
})

function zeros(labels: string[]): OverviewTimeSeriesPoint[] {
  return labels.map((label) => ({ label, value: 0 }))
}

function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(
    dashboardZonedTimeToUtcMs(y ?? 1970, m ?? 1, d ?? 1, 12, 0, 0)
  )
}

function mondayOfWeek(day: Date): Date {
  const start = startOfDashboardDay(day)
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(start)
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  const dow = map[weekday] ?? 0
  const offset = dow === 0 ? -6 : 1 - dow
  return addDashboardDays(start, offset)
}

/** Full today calendar day hours (00–23 ET). */
function bucketsToday(now: Date): string[] {
  const start = startOfDashboardDay(now)
  const end = addDashboardDays(start, 1)
  const labels: string[] = []
  for (
    let cursor = start.getTime();
    cursor < end.getTime();
    cursor += 60 * 60 * 1000
  ) {
    labels.push(hour12.format(new Date(cursor)))
  }
  return labels
}

/** Full yesterday calendar day hours (00–23 ET). */
function bucketsYesterday(now: Date): string[] {
  const todayStart = startOfDashboardDay(now)
  const yesterdayStart = addDashboardDays(todayStart, -1)
  const labels: string[] = []
  for (
    let cursor = yesterdayStart.getTime();
    cursor < todayStart.getTime();
    cursor += 60 * 60 * 1000
  ) {
    labels.push(hour12.format(new Date(cursor)))
  }
  return labels
}

/** Always Mon–Sun (7 days) for the current week. */
function bucketsThisWeek(now: Date): string[] {
  const monday = mondayOfWeek(now)
  return Array.from({ length: 7 }, (_, i) =>
    shortMonthDay.format(addDashboardDays(monday, i))
  )
}

/** Last 7 calendar days including today. */
function bucketsLast7Days(now: Date): string[] {
  const end = startOfDashboardDay(now)
  return Array.from({ length: 7 }, (_, i) =>
    shortMonthDay.format(addDashboardDays(end, -(6 - i)))
  )
}

/** Previous Mon–Sun. */
function bucketsLastWeek(now: Date): string[] {
  const thisMonday = mondayOfWeek(now)
  const lastMonday = addDashboardDays(thisMonday, -7)
  return Array.from({ length: 7 }, (_, i) =>
    shortMonthDay.format(addDashboardDays(lastMonday, i))
  )
}

function bucketsLastMonth(now: Date): string[] {
  const { year, month } = getDashboardZonedParts(now)
  const thisMonthStart = new Date(dashboardZonedTimeToUtcMs(year, month, 1))
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const prevMonthStart = new Date(
    dashboardZonedTimeToUtcMs(prevYear, prevMonth, 1)
  )
  const labels: string[] = []
  for (
    let cursor = prevMonthStart;
    cursor.getTime() < thisMonthStart.getTime();
    cursor = addDashboardDays(cursor, 1)
  ) {
    labels.push(shortMonthDay.format(cursor))
  }
  return labels
}

/** Full current ET calendar month (1 → last day). */
function bucketsThisMonth(now: Date): string[] {
  const { year, month } = getDashboardZonedParts(now)
  const thisMonthStart = new Date(dashboardZonedTimeToUtcMs(year, month, 1))
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const nextMonthStart = new Date(
    dashboardZonedTimeToUtcMs(nextYear, nextMonth, 1)
  )
  const labels: string[] = []
  for (
    let cursor = thisMonthStart;
    cursor.getTime() < nextMonthStart.getTime();
    cursor = addDashboardDays(cursor, 1)
  ) {
    labels.push(shortMonthDay.format(cursor))
  }
  return labels
}

/** Inclusive custom calendar days from `from` through `to` (YYYY-MM-DD). */
function bucketsCustomRange(custom: DashboardCustomRange): string[] {
  const start = startOfDashboardDay(parseDayKey(custom.from))
  const endInclusive = startOfDashboardDay(parseDayKey(custom.to))
  const labels: string[] = []
  for (
    let cursor = start;
    cursor.getTime() <= endInclusive.getTime();
    cursor = addDashboardDays(cursor, 1)
  ) {
    labels.push(shortMonthDay.format(cursor))
  }
  return labels
}

export function overviewChartLabelsForRange(
  rangeId: OverviewDateRangeId,
  now: Date,
  customRange?: DashboardCustomRange | null
): string[] {
  switch (rangeId) {
    case "today":
      return bucketsToday(now)
    case "yesterday":
      return bucketsYesterday(now)
    case "this_week":
      return bucketsThisWeek(now)
    case "7d":
      return bucketsLast7Days(now)
    case "last_week":
      return bucketsLastWeek(now)
    case "this_month":
      return bucketsThisMonth(now)
    case "last_month":
      return bucketsLastMonth(now)
    case "custom":
      if (customRange?.from && customRange?.to) {
        return bucketsCustomRange(customRange)
      }
      return bucketsLast7Days(now)
  }
}

export function overviewChartPointsForRange(
  rangeId: OverviewDateRangeId,
  now: Date = new Date(),
  customRange?: DashboardCustomRange | null
): OverviewTimeSeriesPoint[] {
  return zeros(overviewChartLabelsForRange(rangeId, now, customRange))
}
