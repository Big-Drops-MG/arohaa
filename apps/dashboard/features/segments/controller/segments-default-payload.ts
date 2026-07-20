import type {
  SegmentValuesByMetric,
  SegmentsByDateRange,
} from "@/features/segments/model/segments"
import { TRAFFIC_RANGE_IDS } from "@/features/traffic/model/traffic-range"

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
    TRAFFIC_RANGE_IDS.map((id) => [id, emptySegmentValues()])
  ) as SegmentsByDateRange
}
