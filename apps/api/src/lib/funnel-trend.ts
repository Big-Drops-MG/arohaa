const round2 = (v: number) => Math.round(v * 100) / 100

/** Percent change vs the immediately prior period of equal length. */
export function computePeriodChangePct(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) {
    if (current === 0) return null
    return 100
  }
  return round2(((current - previous) / previous) * 100)
}
