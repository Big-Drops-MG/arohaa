import type { SegmentsDashboardData } from "@/features/segments/model/segments"
import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import { TRAFFIC_DATE_RANGE_OPTIONS } from "@/features/traffic/model/traffic-range"

export function getSegmentsEmptyDashboardData(
  _landingPagePublicId: string,
  rangeId: OverviewDateRangeId = "7d"
): SegmentsDashboardData {
  void _landingPagePublicId

  return {
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: rangeId,
    summaryKpis: [
      { label: "Top Region", value: "-" },
      { label: "Top Device", value: "-" },
      { label: "Best Day", value: "-" },
      { label: "Best Time", value: "-" },
      { label: "Highest FSR", value: "0%" },
    ],
    performanceByLocation: {
      title: "Performance by location",
      columns: [
        { key: "label", label: "City" },
        { key: "visitors", label: "Visitors" },
        { key: "formSubmitted", label: "Form Submitted" },
        { key: "fsr", label: "FSR" },
      ],
      rows: [],
    },
    performanceByDevice: {
      title: "Performance by device",
      columns: [
        { key: "label", label: "Device" },
        { key: "visitors", label: "Visitors" },
        { key: "formSubmitted", label: "Form Submitted" },
        { key: "fsr", label: "FSR" },
      ],
      rows: [],
    },
    performanceByTime: {
      title: "Performance by time",
      columns: [
        { key: "label", label: "Day" },
        { key: "visitors", label: "Visitors" },
        { key: "formSubmitted", label: "Form Submitted" },
        { key: "fsr", label: "FSR" },
      ],
      rows: [],
    },
  }
}
