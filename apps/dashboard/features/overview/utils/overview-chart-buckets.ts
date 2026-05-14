import type {
  OverviewDateRangeId,
  OverviewTimeSeriesPoint,
} from "@/features/overview/model/overview"

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

const shortMonthDay = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
})

const shortMonthYear = new Intl.DateTimeFormat(undefined, {
  month: "short",
  year: "numeric",
})

const shortMonth = new Intl.DateTimeFormat(undefined, { month: "short" })

const hour12 = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  hour12: true,
})

const monthDayHour = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  hour12: true,
})

function zeros(labels: string[]): OverviewTimeSeriesPoint[] {
  return labels.map((label) => ({ label, value: 0 }))
}

function buckets24h(now: Date): string[] {
  const labels: string[] = []
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  for (let h = 23; h >= 0; h--) {
    const d = new Date(now.getTime() - h * 60 * 60 * 1000)
    if (sameDay(d, now)) {
      labels.push(hour12.format(d))
    } else {
      labels.push(monthDayHour.format(d))
    }
  }
  return labels
}

function buckets7d(now: Date): string[] {
  const end = startOfLocalDay(now)
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(end, -(6 - i))
    return shortMonthDay.format(d)
  })
}

function buckets30d(now: Date): string[] {
  const n = 10
  const end = startOfLocalDay(now)
  return Array.from({ length: n }, (_, i) => {
    const dayOffset = Math.round((29 * i) / Math.max(1, n - 1))
    const d = addDays(end, -29 + dayOffset)
    return shortMonthDay.format(d)
  })
}

function buckets3m(now: Date): string[] {
  const n = 12
  const daysBack = 90
  const end = startOfLocalDay(now)
  return Array.from({ length: n }, (_, i) => {
    const dayOffset = Math.round((daysBack * i) / Math.max(1, n - 1))
    const d = addDays(end, -daysBack + dayOffset)
    return shortMonthDay.format(d)
  })
}

function buckets12m(now: Date): string[] {
  const first = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  return Array.from({ length: 12 }, (_, m) => {
    const d = new Date(first.getFullYear(), first.getMonth() + m, 1)
    const sameYear = d.getFullYear() === now.getFullYear()
    return sameYear ? shortMonth.format(d) : shortMonthYear.format(d)
  })
}

function buckets24m(now: Date): string[] {
  const first = new Date(now.getFullYear(), now.getMonth() - 23, 1)
  return Array.from({ length: 24 }, (_, m) => {
    const d = new Date(first.getFullYear(), first.getMonth() + m, 1)
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
