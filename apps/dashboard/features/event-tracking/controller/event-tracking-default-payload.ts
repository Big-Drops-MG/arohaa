import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import type {
  EventTrackingByDateRange,
  EventTrackingKpiSegmentsByDateRange,
  EventTrackingSubmissionByDateRange,
} from "@/features/event-tracking/model/event-tracking"

const RANGE_IDS: OverviewDateRangeId[] = [
  "24h",
  "7d",
  "30d",
  "3m",
  "12m",
  "24m",
]

export function defaultEventTrackingByDateRange(): EventTrackingByDateRange {
  return Object.fromEntries(
    RANGE_IDS.map((id) => [id, {}])
  ) as EventTrackingByDateRange
}

const emptySubmissionByDateRange: EventTrackingSubmissionByDateRange = {
  "24h": [],
  "7d": [],
  "30d": [],
  "3m": [],
  "12m": [],
  "24m": [],
}

const emptyKpiSegmentsByDateRange: EventTrackingKpiSegmentsByDateRange = {
  "24h": [],
  "7d": [],
  "30d": [],
  "3m": [],
  "12m": [],
  "24m": [],
}

export function defaultEventTrackingSubmissionByDateRange(): EventTrackingSubmissionByDateRange {
  return emptySubmissionByDateRange
}

export function defaultEventTrackingKpiSegmentsByDateRange(): EventTrackingKpiSegmentsByDateRange {
  return emptyKpiSegmentsByDateRange
}
