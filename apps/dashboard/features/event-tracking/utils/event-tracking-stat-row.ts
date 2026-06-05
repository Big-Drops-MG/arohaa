import {
  EVENT_TRACKING_METRIC_ORDER,
  type EventTrackingKpi,
  type EventTrackingMetricId,
} from "@/features/event-tracking/model/event-tracking"
import type {
  OverviewDashboardData,
  OverviewDateRangeId,
  OverviewLandingFormType,
} from "@/features/overview/model/overview"

export function eventTrackingLabelsForFormType(
  formType: OverviewLandingFormType
): Record<EventTrackingMetricId, string> {
  const isZip = formType === "zip"
  return {
    "total-events": "Total Events",
    "call-clicks": "Call Clicks",
    "form-submitted": isZip ? "Zip Submitted" : "Form Submitted",
    "success-rate": isZip ? "ZSR" : "FSR",
  }
}

function defaultEventTrackingDisplayValue(id: EventTrackingMetricId): string {
  if (id === "success-rate") return "0%"
  return "0"
}

function resolveEventTrackingValue(
  data: OverviewDashboardData,
  rangeId: OverviewDateRangeId,
  id: EventTrackingMetricId
): string | undefined {
  const eventValues = data.eventTrackingByDateRange[rangeId] ?? {}
  const kpiValues = data.kpisByDateRange[rangeId] ?? {}

  const direct = eventValues[id]?.trim()
  if (direct) return direct

  if (id === "form-submitted") {
    const fromKpi = kpiValues["form-submitted"]?.trim()
    if (fromKpi) return fromKpi
  }

  if (id === "success-rate") {
    const fromKpi = kpiValues.fsr?.trim()
    if (fromKpi) return fromKpi
  }

  return undefined
}

export function eventTrackingKpisForDateRange(
  data: OverviewDashboardData,
  rangeId: OverviewDateRangeId
): EventTrackingKpi[] {
  const labels = eventTrackingLabelsForFormType(data.formType)

  return EVENT_TRACKING_METRIC_ORDER.map((id) => {
    const raw = resolveEventTrackingValue(data, rangeId, id)
    return {
      id,
      label: labels[id],
      value: raw ?? defaultEventTrackingDisplayValue(id),
    }
  })
}
