import type {
  OverviewDateRangeId,
  OverviewLandingFormType,
} from "@/features/overview/model/overview"
import {
  conversionRateLabel,
  conversionSubmittedColumnLabel,
  hasConversionMetrics,
} from "@/features/overview/model/overview"
import type { SegmentsDashboardData } from "@/features/segments/model/segments"
import { TRAFFIC_DATE_RANGE_OPTIONS } from "@/features/traffic/model/traffic-range"

function formSubmittedLabel(formType: OverviewLandingFormType): string {
  return conversionSubmittedColumnLabel(formType)
}

function rateLabel(formType: OverviewLandingFormType): string {
  return conversionRateLabel(formType)
}

function performanceByTimeColumns(
  rangeId: OverviewDateRangeId,
  formType: OverviewLandingFormType
) {
  const showDate = rangeId !== "today" && rangeId !== "yesterday"
  const showForm = hasConversionMetrics(formType)
  const formSubmitted = formSubmittedLabel(formType)
  const rate = rateLabel(formType)

  return [
    { key: "label", label: "Day" },
    ...(showDate ? [{ key: "date", label: "Date" }] : []),
    { key: "visitors", label: "Visitors" },
    ...(showForm
      ? [
          { key: "formSubmitted", label: formSubmitted },
          { key: "fsr", label: rate },
        ]
      : []),
  ]
}

export function getSegmentsEmptyDashboardData(
  _landingPagePublicId: string,
  rangeId: OverviewDateRangeId = "7d",
  formType: OverviewLandingFormType = "single"
): SegmentsDashboardData {
  void _landingPagePublicId

  const showForm = hasConversionMetrics(formType)
  const formSubmitted = formSubmittedLabel(formType)
  const rate = rateLabel(formType)

  return {
    formType,
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: rangeId,
    summaryKpis: [
      { label: "Top Region", value: "-" },
      { label: "Top Device", value: "-" },
      { label: "Best Day", value: "-" },
      { label: "Best Time", value: "-" },
      ...(showForm
        ? [
            {
              label:
                formType === "zip"
                  ? "Highest ZSR"
                  : formType === "none"
                    ? "Highest SCR"
                    : "Highest FSR",
              value: "0%",
            },
          ]
        : []),
    ],
    performanceByLocation: {
      title: "Performance by location",
      columns: [
        { key: "label", label: "City" },
        { key: "visitors", label: "Visitors" },
        ...(showForm
          ? [
              { key: "formSubmitted", label: formSubmitted },
              { key: "fsr", label: rate },
            ]
          : []),
      ],
      rows: [],
    },
    performanceByDevice: {
      title: "Performance by device",
      columns: [
        { key: "label", label: "Device" },
        { key: "visitors", label: "Visitors" },
        ...(showForm
          ? [
              { key: "formSubmitted", label: formSubmitted },
              { key: "fsr", label: rate },
            ]
          : []),
      ],
      rows: [],
    },
    performanceByTime: {
      title: "Performance by time",
      columns: performanceByTimeColumns(rangeId, formType),
      rows: [],
    },
  }
}
