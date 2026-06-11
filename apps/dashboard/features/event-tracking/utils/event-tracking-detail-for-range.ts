import type {
  EventTrackingKpiSegment,
  EventTrackingSubmissionRow,
} from "@/features/event-tracking/model/event-tracking"
import { withSubmissionShare } from "@/features/event-tracking/utils/event-tracking-submission-share"
import type {
  OverviewDashboardData,
  OverviewDateRangeId,
} from "@/features/overview/model/overview"

export function eventTrackingSubmissionForDateRange(
  data: OverviewDashboardData,
  rangeId: OverviewDateRangeId
): EventTrackingSubmissionRow[] {
  const rows = data.eventTrackingSubmissionByDateRange[rangeId] ?? []
  return withSubmissionShare(rows)
}

export function eventTrackingKpiSegmentsForDateRange(
  data: OverviewDashboardData,
  rangeId: OverviewDateRangeId
): EventTrackingKpiSegment[] {
  return data.eventTrackingKpiSegmentsByDateRange[rangeId] ?? []
}
