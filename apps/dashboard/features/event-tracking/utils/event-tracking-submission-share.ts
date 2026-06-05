import type { EventTrackingSubmissionRow } from "@/features/event-tracking/model/event-tracking"
import { parseTrafficNumericValue } from "@/features/traffic/utils/sort-traffic-table-rows"

function formatShare(count: number, total: number): string {
  if (total <= 0) return "0%"
  const pct = (count / total) * 100
  if (pct > 0 && pct < 0.1) return "<0.1%"
  return `${pct.toFixed(1)}%`
}

export function withSubmissionShare(
  rows: EventTrackingSubmissionRow[]
): EventTrackingSubmissionRow[] {
  if (rows.length === 0) return rows

  const counts = rows.map((row) => parseTrafficNumericValue(row.formSubmitted))
  const total = counts.reduce((sum, count) => sum + count, 0)

  return rows.map((row, index) => ({
    ...row,
    share: formatShare(counts[index] ?? 0, total),
  }))
}
