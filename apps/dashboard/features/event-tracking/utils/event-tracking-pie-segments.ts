import type {
  EventTrackingKpi,
  EventTrackingKpiSegment,
  EventTrackingMetricId,
} from "@/features/event-tracking/model/event-tracking"
import { eventTrackingKpiSegmentOrder } from "@/features/event-tracking/utils/event-tracking-segment-labels"
import { parseTrafficNumericValue } from "@/features/traffic/utils/sort-traffic-table-rows"
import type { OverviewLandingFormType } from "@/features/overview/model/overview"

const PIE_METRIC_IDS = new Set<EventTrackingMetricId>([
  "call-clicks",
  "form-submitted",
])

export function eventTrackingPieSegmentsFromKpis(
  formType: OverviewLandingFormType,
  kpis: EventTrackingKpi[],
  fallbackSegments: EventTrackingKpiSegment[] = []
): EventTrackingKpiSegment[] {
  const kpiById = new Map(kpis.map((kpi) => [kpi.id, kpi]))
  const fallbackById = new Map(
    fallbackSegments.map((segment) => [segment.id, segment.value])
  )
  const order = eventTrackingKpiSegmentOrder(formType)

  return order.map((id) => {
    if (PIE_METRIC_IDS.has(id as EventTrackingMetricId)) {
      const kpi = kpiById.get(id as EventTrackingMetricId)
      return {
        id,
        value: parseTrafficNumericValue(kpi?.value),
      }
    }

    return {
      id,
      value: Math.max(0, fallbackById.get(id) ?? 0),
    }
  })
}
