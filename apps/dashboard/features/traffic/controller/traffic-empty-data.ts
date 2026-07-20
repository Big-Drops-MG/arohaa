import type {
  OverviewDateRangeId,
  OverviewLandingFormType,
} from "@/features/overview/model/overview"
import {
  trafficFormSubmittedLabel,
  trafficRateLabel,
} from "@/features/traffic/controller/traffic-default-payload"
import { TRAFFIC_DATE_RANGE_OPTIONS } from "@/features/traffic/model/traffic-range"
import type { TrafficDashboardData } from "@/features/traffic/model/traffic"

export function getTrafficEmptyDashboardData(
  _landingPagePublicId: string,
  rangeId: OverviewDateRangeId = "7d",
  formType: OverviewLandingFormType = "single"
): TrafficDashboardData {
  void _landingPagePublicId

  const formSubmitted = trafficFormSubmittedLabel(formType)
  const rate = trafficRateLabel(formType)

  return {
    formType,
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
        { key: "formSubmitted", label: formSubmitted },
      ],
      rows: [],
    },
    trafficByDevice: {
      title: "Traffic by device",
      columns: [
        { key: "device", label: "Device" },
        { key: "visitors", label: "Visitors" },
        { key: "formSubmitted", label: formSubmitted },
        { key: "fsr", label: rate },
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
        { key: "formSubmitted", label: formSubmitted },
        { key: "fsr", label: rate },
      ],
      rows: [],
    },
    referrers: [],
    utmByParam: [],
    utmParameters: [],
  }
}
