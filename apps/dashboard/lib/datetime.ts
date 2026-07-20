/**
 * Dashboard display timezone. Use America/New_York so EST/EDT apply correctly year-round.
 */
export const DASHBOARD_TIMEZONE = "America/New_York"
export const DASHBOARD_LOCALE = "en-US"

type ZonedParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function parseDate(
  value: string | number | Date | null | undefined
): Date | null {
  if (value == null || value === "") return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export function getDashboardZonedParts(date: Date): ZonedParts {
  const parts = new Intl.DateTimeFormat(DASHBOARD_LOCALE, {
    timeZone: DASHBOARD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)

  const map: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {}
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value
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

/** UTC ms for a wall-clock time in the dashboard timezone. */
export function dashboardZonedTimeToUtcMs(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
): number {
  let guess = Date.UTC(year, month - 1, day, hour, minute, second)
  for (let i = 0; i < 3; i++) {
    const parts = getDashboardZonedParts(new Date(guess))
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    )
    const desired = Date.UTC(year, month - 1, day, hour, minute, second)
    guess += desired - asUtc
  }
  return guess
}

export function startOfDashboardDay(date: Date): Date {
  const { year, month, day } = getDashboardZonedParts(date)
  return new Date(dashboardZonedTimeToUtcMs(year, month, day, 0, 0, 0))
}

export function addDashboardDays(date: Date, days: number): Date {
  const { year, month, day } = getDashboardZonedParts(date)
  const cursor = new Date(Date.UTC(year, month - 1, day))
  cursor.setUTCDate(cursor.getUTCDate() + days)
  return new Date(
    dashboardZonedTimeToUtcMs(
      cursor.getUTCFullYear(),
      cursor.getUTCMonth() + 1,
      cursor.getUTCDate(),
      0,
      0,
      0
    )
  )
}

export function formatInDashboardTimezone(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions
): string {
  const date = parseDate(value)
  if (!date) return "—"
  return new Intl.DateTimeFormat(DASHBOARD_LOCALE, {
    timeZone: DASHBOARD_TIMEZONE,
    ...options,
  }).format(date)
}

export function formatDashboardDateTime(
  value: string | number | Date | null | undefined
): string {
  return formatInDashboardTimezone(value, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export function formatDashboardDate(
  value: string | number | Date | null | undefined
): string {
  return formatInDashboardTimezone(value, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatDashboardDateLong(
  value: string | number | Date | null | undefined
): string {
  return formatInDashboardTimezone(value, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/** Current Eastern abbreviation for the given instant: EST in winter, EDT in summer. */
export function getDashboardTimezoneAbbreviation(date: Date): "EST" | "EDT" {
  const parts = new Intl.DateTimeFormat(DASHBOARD_LOCALE, {
    timeZone: DASHBOARD_TIMEZONE,
    timeZoneName: "short",
  }).formatToParts(date)
  const name = parts.find((part) => part.type === "timeZoneName")?.value
  if (name === "EST" || name === "EDT") return name

  const zoned = getDashboardZonedParts(date)
  const asUtcMs = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second
  )
  const offsetHours = Math.round((asUtcMs - date.getTime()) / 3_600_000)
  return offsetHours === -4 ? "EDT" : "EST"
}

/** Live clock: HH:MM:SS AM/PM EST|EDT in Eastern Time. */
export function formatDashboardDigitalClock(date: Date): string {
  const { hour, minute, second } = getDashboardZonedParts(date)
  const period = hour >= 12 ? "PM" : "AM"
  const hours12 = hour % 12 || 12
  const zone = getDashboardTimezoneAbbreviation(date)
  return `${String(hours12).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")} ${period} ${zone}`
}

export function createDashboardDateTimeFormatter(
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(DASHBOARD_LOCALE, {
    timeZone: DASHBOARD_TIMEZONE,
    ...options,
  })
}
