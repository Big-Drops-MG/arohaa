import type {
  EventTrackingKpi,
  EventTrackingMetricId,
} from "@/features/event-tracking/model/event-tracking"
import { eventTrackingMetricOrder } from "@/features/event-tracking/model/event-tracking"
import { eventTrackingLabelsForFormType } from "@/features/event-tracking/utils/event-tracking-stat-row"
import type { OverviewLandingFormType } from "@/features/overview/model/overview"

export type EventTrackingKpiSource = {
  totalEvents: number
  callClicks: number
  formStarted: number
  zipSubmit: number
  formSubmitted: number
  fsr: number
  zsr: number
}

function fmtCount(v: number): string {
  const n = Number.isFinite(v) ? v : 0
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`
  if (n >= 1_000) return n.toLocaleString("en-US")
  return String(n)
}

function fmtPct(v: number): string {
  return `${(Number.isFinite(v) ? v : 0).toFixed(1)}%`
}

function metricValue(
  formType: OverviewLandingFormType,
  source: EventTrackingKpiSource,
  id: EventTrackingMetricId
): string {
  switch (id) {
    case "total-events":
      return fmtCount(source.totalEvents)
    case "call-clicks":
      return fmtCount(source.callClicks)
    case "form-started":
      return fmtCount(source.formStarted)
    case "form-submitted":
      return fmtCount(
        formType === "zip" ? source.zipSubmit : source.formSubmitted
      )
    case "success-rate":
      return fmtPct(formType === "zip" ? source.zsr : source.fsr)
    default:
      return "0"
  }
}

export function eventTrackingKpisForFormType(
  formType: OverviewLandingFormType,
  source: EventTrackingKpiSource
): EventTrackingKpi[] {
  const labels = eventTrackingLabelsForFormType(formType)

  return eventTrackingMetricOrder(formType).map((id) => ({
    id,
    label: labels[id],
    value: metricValue(formType, source, id),
  }))
}
