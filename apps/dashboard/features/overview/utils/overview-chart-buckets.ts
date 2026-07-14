import type {
  OverviewDateRangeId,
  OverviewTimeSeriesPoint,
} from "@/features/overview/model/overview"
import {
  addDashboardDays,
  createDashboardDateTimeFormatter,
  getDashboardZonedParts,
  startOfDashboardDay,
} from "@/lib/datetime"

const shortMonthDay = createDashboardDateTimeFormatter({
  month: "short",
  day: "numeric",
})

const shortMonthYear = createDashboardDateTimeFormatter({
  month: "short",
  year: "numeric",
})

const shortMonth = createDashboardDateTimeFormatter({ month: "short" })

const hour12 = createDashboardDateTimeFormatter({
  hour: "numeric",
  hour12: true,
})

const monthDayHour = createDashboardDateTimeFormatter({
  month: "short",
  day: "numeric",
  hour: "numeric",
  hour12: true,
})

function zeros(labels: string[]): OverviewTimeSeriesPoint[] {
  return labels.map((label) => ({ label, value: 0 }))
}

function sameDashboardDay(a: Date, b: Date): boolean {
  const left = getDashboardZonedParts(a)
  const right = getDashboardZonedParts(b)
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day
  )
}

function buckets24h(now: Date): string[] {
  const labels: string[] = []

  for (let h = 23; h >= 0; h--) {
    const d = new Date(now.getTime() - h * 60 * 60 * 1000)
    if (sameDashboardDay(d, now)) {
      labels.push(hour12.format(d))
    } else {
      labels.push(monthDayHour.format(d))
    }
  }
  return labels
}

function buckets7d(now: Date): string[] {
  const end = startOfDashboardDay(now)
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDashboardDays(end, -(6 - i))
    return shortMonthDay.format(d)
  })
}

function buckets30d(now: Date): string[] {
  const n = 10
  const end = startOfDashboardDay(now)
  return Array.from({ length: n }, (_, i) => {
    const dayOffset = Math.round((29 * i) / Math.max(1, n - 1))
    const d = addDashboardDays(end, -29 + dayOffset)
    return shortMonthDay.format(d)
  })
}

function buckets3m(now: Date): string[] {
  const n = 12
  const daysBack = 90
  const end = startOfDashboardDay(now)
  return Array.from({ length: n }, (_, i) => {
    const dayOffset = Math.round((daysBack * i) / Math.max(1, n - 1))
    const d = addDashboardDays(end, -daysBack + dayOffset)
    return shortMonthDay.format(d)
  })
}

function buckets12m(now: Date): string[] {
  const parts = getDashboardZonedParts(now)
  const firstMonthIndex = parts.month - 1 - 11
  return Array.from({ length: 12 }, (_, m) => {
    const cursor = new Date(Date.UTC(parts.year, firstMonthIndex + m, 1))
    const d = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 15)
    )
    const sameYear = getDashboardZonedParts(d).year === parts.year
    return sameYear ? shortMonth.format(d) : shortMonthYear.format(d)
  })
}

function buckets24m(now: Date): string[] {
  const parts = getDashboardZonedParts(now)
  const firstMonthIndex = parts.month - 1 - 23
  return Array.from({ length: 24 }, (_, m) => {
    const cursor = new Date(Date.UTC(parts.year, firstMonthIndex + m, 1))
    const d = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 15)
    )
    return shortMonthYear.format(d)
  })
}

export function overviewChartLabelsForRange(
  rangeId: OverviewDateRangeId,
  now: Date
): string[] {
  switch (rangeId) {
    case "24h":
      return buckets24h(now)
    case "7d":
      return buckets7d(now)
    case "30d":
      return buckets30d(now)
    case "3m":
      return buckets3m(now)
    case "12m":
      return buckets12m(now)
    case "24m":
      return buckets24m(now)
  }
}

export function overviewChartPointsForRange(
  rangeId: OverviewDateRangeId,
  now: Date = new Date()
): OverviewTimeSeriesPoint[] {
  return zeros(overviewChartLabelsForRange(rangeId, now))
}
