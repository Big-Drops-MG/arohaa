import type {
  WebPushCampaignLimits,
  WebPushQuietHours,
} from "../schema/web-push.js"

function parseHhMm(value: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null
  }
  return { hours, minutes }
}

/** Local wall-clock parts for a Date in a timezone (or host local if tz invalid). */
export function getZonedParts(
  date: Date,
  timeZone: string
): { year: number; month: number; day: number; hour: number; minute: number } {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
    const parts = Object.fromEntries(
      fmt.formatToParts(date).map((p) => [p.type, p.value])
    )
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute),
    }
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
    }
  }
}

function zonedLocalToUtc(
  parts: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string
): Date {
  // Iterative approximation: invent UTC guess then correct by offset in that zone.
  let utc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    0,
    0
  )
  for (let i = 0; i < 3; i++) {
    const asDate = new Date(utc)
    const got = getZonedParts(asDate, timeZone)
    const wantedMin =
      parts.year * 525600 +
      parts.month * 43800 +
      parts.day * 1440 +
      parts.hour * 60 +
      parts.minute
    const gotMin =
      got.year * 525600 +
      got.month * 43800 +
      got.day * 1440 +
      got.hour * 60 +
      got.minute
    utc += (wantedMin - gotMin) * 60_000
  }
  return new Date(utc)
}

function minutesOfDay(hour: number, minute: number): number {
  return hour * 60 + minute
}

export function isInQuietHours(
  date: Date,
  quiet: WebPushQuietHours,
  userTimezone?: string | null
): boolean {
  const start = parseHhMm(quiet.start)
  const end = parseHhMm(quiet.end)
  if (!start || !end) return false

  const tz =
    quiet.tz === "user"
      ? userTimezone?.trim() || "UTC"
      : quiet.tz?.trim() || "UTC"

  const parts = getZonedParts(date, tz)
  const nowM = minutesOfDay(parts.hour, parts.minute)
  const startM = minutesOfDay(start.hours, start.minutes)
  const endM = minutesOfDay(end.hours, end.minutes)

  if (startM === endM) return false
  if (startM < endM) {
    return nowM >= startM && nowM < endM
  }
  // Wraps midnight, e.g. 22:00–08:00
  return nowM >= startM || nowM < endM
}

/** If `date` falls in quiet hours, return the next quiet-end instant; else return date. */
export function adjustForQuietHours(
  date: Date,
  quiet: WebPushQuietHours | null | undefined,
  userTimezone?: string | null
): Date {
  if (!quiet?.start || !quiet?.end) return date
  if (!isInQuietHours(date, quiet, userTimezone)) return date

  const end = parseHhMm(quiet.end)
  if (!end) return date

  const tz =
    quiet.tz === "user"
      ? userTimezone?.trim() || "UTC"
      : quiet.tz?.trim() || "UTC"

  const parts = getZonedParts(date, tz)
  const start = parseHhMm(quiet.start)!
  const nowM = minutesOfDay(parts.hour, parts.minute)
  const startM = minutesOfDay(start.hours, start.minutes)
  const endM = minutesOfDay(end.hours, end.minutes)

  let dayOffset = 0
  if (startM < endM) {
    // Same-day window: move to end today
    dayOffset = 0
  } else {
    // Overnight: if we're after start (evening), end is tomorrow; if before end (morning), end is today
    dayOffset = nowM >= startM ? 1 : 0
  }

  const base = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset, 0, 0, 0, 0)
  )
  const baseParts = getZonedParts(base, tz)
  // Use calendar day from zoned base then set end time
  const targetDay = new Date(date)
  // Build local end on correct day via parts arithmetic
  const localEndParts = {
    year: parts.year,
    month: parts.month,
    day: parts.day + dayOffset,
    hour: end.hours,
    minute: end.minutes,
  }
  // Normalize day overflow using Date.UTC month arithmetic in local parts
  const norm = new Date(
    Date.UTC(
      localEndParts.year,
      localEndParts.month - 1,
      localEndParts.day,
      12,
      0,
      0,
      0
    )
  )
  localEndParts.year = norm.getUTCFullYear()
  localEndParts.month = norm.getUTCMonth() + 1
  localEndParts.day = norm.getUTCDate()

  void baseParts
  const adjusted = zonedLocalToUtc(localEndParts, tz)
  // Ensure we always move forward
  if (adjusted.getTime() <= date.getTime()) {
    localEndParts.day += 1
    const norm2 = new Date(
      Date.UTC(
        localEndParts.year,
        localEndParts.month - 1,
        localEndParts.day,
        12,
        0,
        0,
        0
      )
    )
    return zonedLocalToUtc(
      {
        year: norm2.getUTCFullYear(),
        month: norm2.getUTCMonth() + 1,
        day: norm2.getUTCDate(),
        hour: end.hours,
        minute: end.minutes,
      },
      tz
    )
  }
  return adjusted
}

export function resolveQuietHoursFromLimits(
  limits: WebPushCampaignLimits | null | undefined
): WebPushQuietHours | null {
  const q = limits?.quietHours
  if (!q?.start || !q?.end) return null
  return q
}
