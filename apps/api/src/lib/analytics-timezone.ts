/**
 * Analytics timezone for ClickHouse bucketing and TypeScript timeline keys.
 * America/New_York observes EST/EDT automatically.
 */
export const ANALYTICS_TIMEZONE = 'America/New_York'
export const ANALYTICS_DISPLAY_LOCALE = 'en-US'

/** Quoted timezone literal for ClickHouse SQL. */
export const CH_TZ = `'${ANALYTICS_TIMEZONE}'`
export const CH_UTC_TZ = "'UTC'"

export function chToDate(expr = 'created_at'): string {
  return `toDate(${expr}, ${CH_TZ})`
}

export function chToStartOfMonth(expr = 'created_at'): string {
  return `toStartOfMonth(${expr}, ${CH_TZ})`
}

export function chToMonday(expr = 'created_at'): string {
  return `toMonday(${chToDate(expr)})`
}

export function chToDayOfWeek(expr = 'created_at', mode = 1): string {
  return `toDayOfWeek(${expr}, ${mode}, ${CH_TZ})`
}

export function chToHour(expr = 'created_at'): string {
  return `toHour(${expr}, ${CH_TZ})`
}

export function chToday(): string {
  return `toDate(now(), ${CH_TZ})`
}

/**
 * Rolling 24-hour charts need an instant-based key so the repeated Eastern
 * 1 AM hour at the fall DST transition remains two distinct buckets.
 */
export function chHourBucketKey(expr = 'created_at'): string {
  return `formatDateTime(${expr}, '%Y-%m-%dT%H', ${CH_UTC_TZ})`
}

/** Day key: YYYY-MM-DD in Eastern Time. */
export function chDayBucketKey(expr = 'created_at'): string {
  return `formatDateTime(${expr}, '%Y-%m-%d', ${CH_TZ})`
}

/** Month key: YYYY-MM in Eastern Time. */
export function chMonthBucketKey(expr = 'created_at'): string {
  return `formatDateTime(${expr}, '%Y-%m', ${CH_TZ})`
}

/** Monday of week (YYYY-MM-DD) in Eastern Time. */
export function chWeekBucketKey(expr = 'created_at'): string {
  return `toString(${chToMonday(expr)})`
}

type EtParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

export function getAnalyticsEtParts(date: Date): EtParts {
  const parts = new Intl.DateTimeFormat(ANALYTICS_DISPLAY_LOCALE, {
    timeZone: ANALYTICS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const map: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {}
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  }
}

/** UTC ms for a wall-clock time in America/New_York. */
export function analyticsEtToUtcMs(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): number {
  let guess = Date.UTC(year, month - 1, day, hour, minute, second)
  for (let i = 0; i < 3; i++) {
    const parts = getAnalyticsEtParts(new Date(guess))
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    )
    const desired = Date.UTC(year, month - 1, day, hour, minute, second)
    guess += desired - asUtc
  }
  return guess
}

export function analyticsEtDate(date: Date): Date {
  const { year, month, day, hour, minute, second } = getAnalyticsEtParts(date)
  return new Date(analyticsEtToUtcMs(year, month, day, hour, minute, second))
}

export function startOfAnalyticsEtDay(date: Date): Date {
  const { year, month, day } = getAnalyticsEtParts(date)
  return new Date(analyticsEtToUtcMs(year, month, day, 0, 0, 0))
}

export function startOfAnalyticsEtHour(date: Date): Date {
  const start = new Date(date)
  start.setUTCMinutes(0, 0, 0)
  return start
}

export function addAnalyticsEtDays(date: Date, days: number): Date {
  const { year, month, day } = getAnalyticsEtParts(date)
  const cursor = new Date(Date.UTC(year, month - 1, day))
  cursor.setUTCDate(cursor.getUTCDate() + days)
  return new Date(
    analyticsEtToUtcMs(
      cursor.getUTCFullYear(),
      cursor.getUTCMonth() + 1,
      cursor.getUTCDate(),
      0,
      0,
      0,
    ),
  )
}

export function analyticsHourKey(date: Date): string {
  return date.toISOString().slice(0, 13)
}

export function analyticsDayKey(date: Date): string {
  const { year, month, day } = getAnalyticsEtParts(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function analyticsMonthKey(date: Date): string {
  const { year, month } = getAnalyticsEtParts(date)
  return `${year}-${String(month).padStart(2, '0')}`
}

/** Monday (ET calendar) YYYY-MM-DD for the week containing date. */
export function analyticsMondayKey(date: Date): string {
  const start = startOfAnalyticsEtDay(date)
  const parts = getAnalyticsEtParts(start)
  // weekday: 0=Sun … 6=Sat in ET
  const weekday = new Intl.DateTimeFormat(ANALYTICS_DISPLAY_LOCALE, {
    timeZone: ANALYTICS_TIMEZONE,
    weekday: 'short',
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
  const diff = dow === 0 ? -6 : 1 - dow
  return analyticsDayKey(addAnalyticsEtDays(start, diff))
}

export function formatAnalyticsSeriesHour(bucket: Date): string {
  return new Intl.DateTimeFormat(ANALYTICS_DISPLAY_LOCALE, {
    timeZone: ANALYTICS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(bucket)
}

export function formatAnalyticsSeriesMonthDay(bucket: Date): string {
  return new Intl.DateTimeFormat(ANALYTICS_DISPLAY_LOCALE, {
    timeZone: ANALYTICS_TIMEZONE,
    month: 'short',
    day: 'numeric',
  }).format(bucket)
}

export function formatAnalyticsSeriesMonthYear(bucket: Date): string {
  const mon = new Intl.DateTimeFormat(ANALYTICS_DISPLAY_LOCALE, {
    timeZone: ANALYTICS_TIMEZONE,
    month: 'short',
  }).format(bucket)
  const year = new Intl.DateTimeFormat(ANALYTICS_DISPLAY_LOCALE, {
    timeZone: ANALYTICS_TIMEZONE,
    year: '2-digit',
  }).format(bucket)
  return `${mon} '${year}`
}

export function formatAnalyticsCalendarDate(bucket: Date): string {
  return new Intl.DateTimeFormat(ANALYTICS_DISPLAY_LOCALE, {
    timeZone: ANALYTICS_TIMEZONE,
    month: 'short',
    day: 'numeric',
  }).format(bucket)
}

/** Parse CH day/month string keys (already ET calendar) for display. */
export function parseAnalyticsEtDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(analyticsEtToUtcMs(y ?? 1970, m ?? 1, d ?? 1, 12, 0, 0))
}

export function parseAnalyticsEtMonthKey(key: string): Date {
  const [y, m] = key.split('-').map(Number)
  return new Date(analyticsEtToUtcMs(y ?? 1970, m ?? 1, 1, 12, 0, 0))
}
