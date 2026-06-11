import type { SegmentsDashboardData } from "@/features/segments/model/segments"

const dateRangeOptions = [
  { id: "24h" as const, label: "Last 24 hours" },
  { id: "7d" as const, label: "Last 7 days" },
  { id: "30d" as const, label: "Last 30 days" },
  { id: "3m" as const, label: "Last 3 months" },
  { id: "12m" as const, label: "Last 12 months" },
  { id: "24m" as const, label: "Last 24 months" },
]

export function getSegmentsPlaceholderData(
  _landingPagePublicId: string
): SegmentsDashboardData {
  void _landingPagePublicId

  return {
    dateRangeOptions: [...dateRangeOptions],
    defaultDateRangeId: "7d",
    summaryKpis: [
      { label: "Top Region", value: "New York" },
      { label: "Top Device", value: "Mobile" },
      { label: "Best Day", value: "Tuesday" },
      { label: "Best Time", value: "Evening" },
      { label: "Highest FSR", value: "25%" },
    ],
    performanceByLocation: {
      title: "Performance by location",
      columns: [
        { key: "label", label: "City" },
        { key: "visitors", label: "Visitors" },
        { key: "formSubmitted", label: "Form Submitted" },
        { key: "fsr", label: "FSR" },
      ],
      rows: [
        {
          label: "New York",
          visitors: "2,000",
          formSubmitted: "400",
          fsr: "20%",
        },
        {
          label: "Chicago",
          visitors: "1,500",
          formSubmitted: "300",
          fsr: "20%",
        },
        {
          label: "Dallas",
          visitors: "1,200",
          formSubmitted: "180",
          fsr: "15%",
        },
        { label: "Miami", visitors: "900", formSubmitted: "150", fsr: "16%" },
      ],
    },
    performanceByDevice: {
      title: "Performance by device",
      columns: [
        { key: "label", label: "Device" },
        { key: "visitors", label: "Visitors" },
        { key: "formSubmitted", label: "Form Submitted" },
        { key: "fsr", label: "FSR" },
      ],
      rows: [
        {
          label: "Mobile",
          visitors: "6,000",
          formSubmitted: "900",
          fsr: "15%",
        },
        {
          label: "Desktop",
          visitors: "4,000",
          formSubmitted: "800",
          fsr: "20%",
        },
        {
          label: "Tablet",
          visitors: "1,000",
          formSubmitted: "100",
          fsr: "10%",
        },
      ],
    },
    performanceByTime: {
      title: "Performance by time",
      columns: [
        { key: "label", label: "Day" },
        { key: "visitors", label: "Visitors" },
        { key: "formSubmitted", label: "Form Submitted" },
        { key: "fsr", label: "FSR" },
      ],
      rows: [
        {
          label: "Monday",
          visitors: "1,200",
          formSubmitted: "200",
          fsr: "16%",
        },
        {
          label: "Tuesday",
          visitors: "1,400",
          formSubmitted: "250",
          fsr: "18%",
        },
        {
          label: "Wednesday",
          visitors: "1,100",
          formSubmitted: "180",
          fsr: "16%",
        },
      ],
    },
  }
}
