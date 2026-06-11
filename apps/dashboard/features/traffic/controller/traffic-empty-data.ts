import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import { TRAFFIC_DATE_RANGE_OPTIONS } from "@/features/traffic/model/traffic-range"
import type { TrafficDashboardData } from "@/features/traffic/model/traffic"

export function getTrafficEmptyDashboardData(
  _landingPagePublicId: string,
  rangeId: OverviewDateRangeId = "7d"
): TrafficDashboardData {
  void _landingPagePublicId

  return {
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: rangeId,
    defaultKpiMetricId: "active-users",
    kpis: [
      {
        id: "active-users",
        label: "Active Users Right Now",
        value: "0 Users",
      },
      { id: "visitors", label: "Visitors", value: "0" },
      { id: "sessions", label: "Sessions", value: "0" },
      { id: "page-views", label: "Page Views", value: "0" },
      { id: "bounce-rate", label: "Bounce Rate", value: "0.0%" },
    ],
    trafficByTime: {
      title: "Traffic by time",
      columns: [
        { key: "date", label: "Date" },
        { key: "visitors", label: "Visitors" },
        { key: "sessions", label: "Sessions" },
        { key: "formSubmitted", label: "Form Submitted" },
      ],
      rows: [],
    },
    trafficByDevice: {
      title: "Traffic by device",
      columns: [
        { key: "device", label: "Device" },
        { key: "visitors", label: "Visitors" },
        { key: "formSubmitted", label: "Form Submitted" },
        { key: "fsr", label: "FSR" },
      ],
      rows: [],
    },
    topPages: {
      title: "Top pages",
      columns: [
        { key: "page", label: "Pages" },
        { key: "visitors", label: "Visitors", align: "right" },
      ],
      rows: [],
    },
    trafficByLocation: {
      title: "Traffic by location",
      columns: [
        { key: "city", label: "City" },
        { key: "visitors", label: "Visitors" },
        { key: "formSubmitted", label: "Form Submitted" },
        { key: "fsr", label: "FSR" },
      ],
      rows: [],
    },
    referrers: [],
    utmParameters: [],
  }
}
