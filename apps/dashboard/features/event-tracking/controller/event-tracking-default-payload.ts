import type {
  EventTrackingByDateRange,
  EventTrackingKpiSegment,
  EventTrackingKpiSegmentsByDateRange,
  EventTrackingSubmissionByDateRange,
  EventTrackingSubmissionRow,
} from "@/features/event-tracking/model/event-tracking"
import { TRAFFIC_RANGE_IDS } from "@/features/traffic/model/traffic-range"

export function defaultEventTrackingByDateRange(): EventTrackingByDateRange {
  return Object.fromEntries(
    TRAFFIC_RANGE_IDS.map((id) => [id, {}])
  ) as EventTrackingByDateRange
}

export function defaultEventTrackingSubmissionByDateRange(): EventTrackingSubmissionByDateRange {
  return Object.fromEntries(
    TRAFFIC_RANGE_IDS.map((id) => [id, [] as EventTrackingSubmissionRow[]])
  ) as EventTrackingSubmissionByDateRange
}

export function defaultEventTrackingKpiSegmentsByDateRange(): EventTrackingKpiSegmentsByDateRange {
  return Object.fromEntries(
    TRAFFIC_RANGE_IDS.map((id) => [id, [] as EventTrackingKpiSegment[]])
  ) as EventTrackingKpiSegmentsByDateRange
}
