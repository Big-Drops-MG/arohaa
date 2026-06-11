import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import type { OverviewAlert } from "@/features/overview/model/overview"
import type { AlertsByDateRange } from "@/features/alerts/model/alerts"

const RANGE_IDS: OverviewDateRangeId[] = [
  "24h",
  "7d",
  "30d",
  "3m",
  "12m",
  "24m",
]

export function defaultAlertsByDateRange(): AlertsByDateRange {
  return Object.fromEntries(
    RANGE_IDS.map((id) => [id, [] as OverviewAlert[]])
  ) as AlertsByDateRange
}
