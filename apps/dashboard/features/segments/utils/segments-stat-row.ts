import {
  segmentMetricOrder,
  type SegmentKpi,
  type SegmentMetricId,
} from "@/features/segments/model/segments"
import type {
  OverviewDashboardData,
  OverviewDateRangeId,
  OverviewLandingFormType,
} from "@/features/overview/model/overview"

export function segmentLabelsForFormType(
  formType: OverviewLandingFormType
): Record<SegmentMetricId, string> {
  return {
    "top-region": "Top Region",
    "top-device": "Top Device",
    "best-day": "Best Day",
    "best-time": "Best Time",
    "highest-fsr":
      formType === "none"
        ? "Highest SCR"
        : formType === "zip"
          ? "Highest ZSR"
          : "Highest FSR",
  }
}

function defaultSegmentDisplayValue(id: SegmentMetricId): string {
  if (id === "highest-fsr") return "0%"
  return "-"
}

export function segmentKpisForDateRange(
  data: OverviewDashboardData,
  rangeId: OverviewDateRangeId
): SegmentKpi[] {
  const labels = segmentLabelsForFormType(data.formType)
  const values = data.segmentsByDateRange[rangeId] ?? {}

  return segmentMetricOrder(data.formType).map((id) => {
    const raw = values[id]?.trim()
    return {
      id,
      label: labels[id],
      value: raw ?? defaultSegmentDisplayValue(id),
    }
  })
}
