import type {
  OverviewDateRangeId,
  OverviewLandingFormType,
} from "@/features/overview/model/overview"
import type { TrafficBreakdownTable } from "@/features/traffic/model/traffic"

function formSubmittedLabel(formType: OverviewLandingFormType): string {
  return formType === "zip" ? "Zip Submitted" : "Form Submitted"
}

function rateLabel(formType: OverviewLandingFormType): string {
  return formType === "zip" ? "ZSR" : "FSR"
}

function performanceMetricColumns(
  formType: OverviewLandingFormType,
  dimension: { id: string; label: string }
): TrafficBreakdownTable["columns"] {
  const formSubmitted = formSubmittedLabel(formType)
  const rate = rateLabel(formType)

  return [
    { id: dimension.id, label: dimension.label },
    { id: "visitors", label: "Visitors", align: "right" },
    { id: "formSubmitted", label: formSubmitted, align: "right" },
    { id: "rate", label: rate, align: "right" },
  ]
}

export function segmentPerformanceLocationColumns(
  formType: OverviewLandingFormType
): TrafficBreakdownTable["columns"] {
  return performanceMetricColumns(formType, { id: "city", label: "City" })
}

export function segmentPerformanceDeviceColumns(
  formType: OverviewLandingFormType
): TrafficBreakdownTable["columns"] {
  return performanceMetricColumns(formType, { id: "device", label: "Device" })
}

export function segmentPerformanceHourColumns(
  formType: OverviewLandingFormType
): TrafficBreakdownTable["columns"] {
  return performanceMetricColumns(formType, { id: "time", label: "Time" })
}

export function segmentPerformancePeriodColumns(
  formType: OverviewLandingFormType,
  rangeId: OverviewDateRangeId
): TrafficBreakdownTable["columns"] {
  const dimension =
    rangeId === "3m" || rangeId === "12m" || rangeId === "24m"
      ? { id: "month", label: "Month" }
      : { id: "day", label: "Day" }

  return performanceMetricColumns(formType, dimension)
}

export function segmentPerformancePeriodTitle(
  rangeId: OverviewDateRangeId
): string | null {
  if (rangeId === "24h") return null

  if (rangeId === "3m" || rangeId === "12m" || rangeId === "24m") {
    return "Performance by Month"
  }

  return "Performance by Day"
}

export function showSegmentPerformancePeriodCard(
  rangeId: OverviewDateRangeId
): boolean {
  return rangeId !== "24h"
}
