export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
}

export const DAY_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

/** ClickHouse toDayOfWeek(..., 1) returns 1=Mon … 7=Sun; mode 0 uses 0=Sun. */
export function formatDayOfWeek(raw: string | number | null | undefined): string {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return 'Unknown'
  return DAY_OF_WEEK_LABELS[n] ?? 'Unknown'
}
