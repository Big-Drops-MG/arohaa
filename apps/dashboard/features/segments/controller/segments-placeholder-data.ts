import type { SegmentsDashboardData } from "@/features/segments/model/segments"
import { TRAFFIC_DATE_RANGE_OPTIONS } from "@/features/traffic/model/traffic-range"

export function getSegmentsPlaceholderData(
  _landingPagePublicId: string
): SegmentsDashboardData {
  void _landingPagePublicId

  return {
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
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
        { key: "date", label: "Date" },
        { key: "visitors", label: "Visitors" },
        { key: "formSubmitted", label: "Form Submitted" },
        { key: "fsr", label: "FSR" },
      ],
      rows: [
        {
          label: "Monday",
          date: "Jul 14",
          visitors: "1,200",
          formSubmitted: "200",
          fsr: "16%",
        },
        {
          label: "Tuesday",
          date: "Jul 15",
          visitors: "1,400",
          formSubmitted: "250",
          fsr: "18%",
        },
        {
          label: "Wednesday",
          date: "Jul 16",
          visitors: "1,100",
          formSubmitted: "180",
          fsr: "16%",
        },
      ],
    },
  }
}
