import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import type {
  SegmentValuesByMetric,
  SegmentsByDateRange,
} from "@/features/segments/model/segments"

const RANGE_IDS: OverviewDateRangeId[] = [
  "24h",
  "7d",
  "30d",
  "3m",
  "12m",
  "24m",
]

function emptySegmentValues(): SegmentValuesByMetric {
  return {
    "top-region": "-",
    "top-device": "-",
    "best-day": "-",
    "best-time": "-",
    "highest-fsr": "0%",
  }
}

export function defaultSegmentsByDateRange(): SegmentsByDateRange {
  return Object.fromEntries(
    RANGE_IDS.map((id) => [id, emptySegmentValues()])
  ) as SegmentsByDateRange
}
