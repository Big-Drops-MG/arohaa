import type { OverviewAlert } from "@/features/overview/model/overview"
import type { AlertsByDateRange } from "@/features/alerts/model/alerts"
import { TRAFFIC_RANGE_IDS } from "@/features/traffic/model/traffic-range"

export function defaultAlertsByDateRange(): AlertsByDateRange {
  return Object.fromEntries(
    TRAFFIC_RANGE_IDS.map((id) => [id, [] as OverviewAlert[]])
  ) as AlertsByDateRange
}
