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
  _rangeId: OverviewDateRangeId
): TrafficBreakdownTable["columns"] {
  return performanceMetricColumns(formType, { id: "day", label: "Day" })
}

export function segmentPerformancePeriodTitle(
  rangeId: OverviewDateRangeId
): string | null {
  if (rangeId === "today" || rangeId === "yesterday") return null
  return "Performance by Day"
}

export function showSegmentPerformancePeriodCard(
  rangeId: OverviewDateRangeId
): boolean {
  return rangeId !== "today" && rangeId !== "yesterday"
}
