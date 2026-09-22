import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import type { DashboardCustomRange } from "@/features/traffic/model/traffic-range"
import {
  addDashboardDays,
  dashboardZonedTimeToUtcMs,
  getDashboardZonedParts,
  startOfDashboardDay,
} from "@/lib/datetime"

export type NotificationCenterSeriesGranularity = "day" | "week" | "month"

export type NotificationCenterAnalyticsWindow = {
  rangeId: OverviewDateRangeId
  start: Date
  end: Date
  seriesEnd: Date
  dayKeys: string[]
  seriesGranularity: NotificationCenterSeriesGranularity
  custom?: DashboardCustomRange
}

function dayKeyFromDate(date: Date): string {
  const { year, month, day } = getDashboardZonedParts(date)
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function monthKeyFromDate(date: Date): string {
  const { year, month } = getDashboardZonedParts(date)
  return `${year}-${String(month).padStart(2, "0")}`
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

function eachDayKey(start: Date, seriesEnd: Date): string[] {
  const keys: string[] = []
  for (
    let cursor = startOfDashboardDay(start);
    cursor < seriesEnd;
    cursor = addDashboardDays(cursor, 1)
  ) {
    keys.push(dayKeyFromDate(cursor))
  }
  return keys
}

function eachWeekKey(start: Date, seriesEnd: Date): string[] {
  const keys: string[] = []
  for (
    let cursor = mondayOfWeek(start);
    cursor < seriesEnd;
    cursor = addDashboardDays(cursor, 7)
  ) {
    keys.push(dayKeyFromDate(cursor))
  }
  return keys
}

function eachMonthKey(start: Date, seriesEnd: Date): string[] {
  const keys: string[] = []
  const startParts = getDashboardZonedParts(start)
  let year = startParts.year
  let month = startParts.month
  for (;;) {
    const cursor = new Date(dashboardZonedTimeToUtcMs(year, month, 1, 0, 0, 0))
    if (cursor >= seriesEnd) break
    keys.push(monthKeyFromDate(cursor))
    if (month === 12) {
      month = 1
      year += 1
    } else {
      month += 1
    }
  }
  return keys
}

function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b
}

function spanDays(start: Date, seriesEnd: Date): number {
  const ms = seriesEnd.getTime() - startOfDashboardDay(start).getTime()
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

function pickGranularity(
  start: Date,
  seriesEnd: Date
): NotificationCenterSeriesGranularity {
  const days = spanDays(start, seriesEnd)
  if (days <= 62) return "day"
  if (days <= 366) return "week"
  return "month"
}

function seriesKeysForWindow(
  start: Date,
  seriesEnd: Date,
  granularity: NotificationCenterSeriesGranularity
): string[] {
  if (granularity === "week") return eachWeekKey(start, seriesEnd)
  if (granularity === "month") return eachMonthKey(start, seriesEnd)
  return eachDayKey(start, seriesEnd)
}

function windowWithSeries(
  rangeId: OverviewDateRangeId,
  start: Date,
  end: Date,
  seriesEnd: Date,
  custom?: DashboardCustomRange
): NotificationCenterAnalyticsWindow {
  const seriesGranularity = pickGranularity(start, seriesEnd)
  return {
    rangeId,
    start,
    end,
    seriesEnd,
    seriesGranularity,
    dayKeys: seriesKeysForWindow(start, seriesEnd, seriesGranularity),
    ...(custom ? { custom } : {}),
  }
}

export function seriesBucketKey(
  ts: Date,
  granularity: NotificationCenterSeriesGranularity
): string {
  if (granularity === "month") return monthKeyFromDate(ts)
  if (granularity === "week") return dayKeyFromDate(mondayOfWeek(ts))
  return dayKeyFromDate(ts)
}

export function resolveNotificationCenterAnalyticsWindow(
  rangeId: OverviewDateRangeId,
  now: Date = new Date(),
  custom?: DashboardCustomRange | null,
  originAt?: Date | null
): NotificationCenterAnalyticsWindow {
  if (rangeId === "custom" && custom) {
    const [fy, fm, fd] = custom.from.split("-").map(Number)
    const [ty, tm, td] = custom.to.split("-").map(Number)
    const start = new Date(
      dashboardZonedTimeToUtcMs(fy ?? 1970, fm ?? 1, fd ?? 1, 0, 0, 0)
    )
    const seriesEnd = addDashboardDays(
      new Date(
        dashboardZonedTimeToUtcMs(ty ?? 1970, tm ?? 1, td ?? 1, 0, 0, 0)
      ),
      1
    )
    return windowWithSeries(
      "custom",
      start,
      minDate(seriesEnd, now),
      seriesEnd,
      custom
    )
  }

  if (rangeId === "all_time") {
    const ALL_TIME_FLOOR = new Date(Date.UTC(2000, 0, 1, 5, 0, 0))
    const start = startOfDashboardDay(ALL_TIME_FLOOR)
    const seriesEnd = addDashboardDays(startOfDashboardDay(now), 1)
    // Full history through end of today (same bounds as analytics API).
    return windowWithSeries("all_time", start, seriesEnd, seriesEnd)
  }

  if (rangeId === "today") {
    const start = startOfDashboardDay(now)
    const seriesEnd = addDashboardDays(start, 1)
    return windowWithSeries(rangeId, start, now, seriesEnd)
  }

  if (rangeId === "yesterday") {
    const todayStart = startOfDashboardDay(now)
    const start = addDashboardDays(todayStart, -1)
    return windowWithSeries(rangeId, start, todayStart, todayStart)
  }

  if (rangeId === "this_week") {
    const monday = mondayOfWeek(now)
    const seriesEnd = addDashboardDays(monday, 7)
    return windowWithSeries(rangeId, monday, now, seriesEnd)
  }

  if (rangeId === "last_week") {
    const thisMonday = mondayOfWeek(now)
    const start = addDashboardDays(thisMonday, -7)
    const seriesEnd = thisMonday
    return windowWithSeries(rangeId, start, seriesEnd, seriesEnd)
  }

  if (rangeId === "this_month") {
    const { year, month } = getDashboardZonedParts(now)
    const start = new Date(dashboardZonedTimeToUtcMs(year, month, 1, 0, 0, 0))
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const seriesEnd = new Date(
      dashboardZonedTimeToUtcMs(nextYear, nextMonth, 1, 0, 0, 0)
    )
    return windowWithSeries(rangeId, start, now, seriesEnd)
  }

  if (rangeId === "last_month") {
    const { year, month } = getDashboardZonedParts(now)
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    const start = new Date(
      dashboardZonedTimeToUtcMs(prevYear, prevMonth, 1, 0, 0, 0)
    )
    const seriesEnd = new Date(
      dashboardZonedTimeToUtcMs(year, month, 1, 0, 0, 0)
    )
    return windowWithSeries(rangeId, start, seriesEnd, seriesEnd)
  }

  // Default 7d
  const todayStart = startOfDashboardDay(now)
  const start = addDashboardDays(todayStart, -6)
  const seriesEnd = addDashboardDays(todayStart, 1)
  return windowWithSeries("7d", start, now, seriesEnd)
}

export function formatNcDayLabel(
  dayKey: string,
  granularity: NotificationCenterSeriesGranularity = "day"
): string {
  if (granularity === "month" && /^\d{4}-\d{2}$/.test(dayKey)) {
    const [y, m] = dayKey.split("-").map(Number)
    const date = new Date(
      dashboardZonedTimeToUtcMs(y ?? 1970, m ?? 1, 1, 12, 0, 0)
    )
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "America/New_York",
    }).format(date)
  }

  const [y, m, d] = dayKey.split("-").map(Number)
  const date = new Date(
    dashboardZonedTimeToUtcMs(y ?? 1970, m ?? 1, d ?? 1, 12, 0, 0)
  )
  if (granularity === "week") {
    return `Week of ${new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "America/New_York",
    }).format(date)}`
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(date)
}
