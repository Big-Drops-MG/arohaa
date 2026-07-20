import type { OverviewLandingFormType } from "@/features/overview/model/overview"
import {
  trafficFormSubmittedLabel,
  trafficRateLabel,
} from "@/features/traffic/controller/traffic-default-payload"
import { TRAFFIC_DATE_RANGE_OPTIONS } from "@/features/traffic/model/traffic-range"
import type { TrafficDashboardData } from "@/features/traffic/model/traffic"

export function getTrafficPlaceholderData(
  _landingPagePublicId: string,
  formType: OverviewLandingFormType = "single"
): TrafficDashboardData {
  void _landingPagePublicId

  const formSubmitted = trafficFormSubmittedLabel(formType)
  const rate = trafficRateLabel(formType)

  return {
    formType,
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: "7d",
    defaultKpiMetricId: "active-users",
    kpis: [
      {
        id: "active-users",
        label: "Active Users Right Now",
        value: "128 Users",
      },
      { id: "visitors", label: "Visitors", value: "12,480" },
      { id: "sessions", label: "Sessions", value: "18,920" },
      { id: "page-views", label: "Page Views", value: "42,300" },
      { id: "bounce-rate", label: "Bounce Rate", value: "38%" },
    ],
    trafficByTime: {
      title: "Traffic by time",
      columns: [
        { key: "date", label: "Date" },
        { key: "visitors", label: "Visitors" },
        { key: "sessions", label: "Sessions" },
        { key: "formSubmitted", label: formSubmitted },
      ],
      rows: [
        {
          date: "Apr 1",
          visitors: "1,200",
          sessions: "980",
          formSubmitted: "120",
        },
        {
          date: "Apr 2",
          visitors: "1,400",
          sessions: "1,100",
          formSubmitted: "150",
        },
        {
          date: "Apr 3",
          visitors: "1,100",
          sessions: "900",
          formSubmitted: "100",
        },
      ],
    },
    trafficByDevice: {
      title: "Traffic by device",
      columns: [
        { key: "device", label: "Device" },
        { key: "visitors", label: "Visitors" },
        { key: "formSubmitted", label: formSubmitted },
        { key: "fsr", label: rate },
      ],
      rows: [
        {
          device: "Mobile",
          visitors: "6,000",
          formSubmitted: "900",
          fsr: "15%",
        },
        {
          device: "Desktop",
          visitors: "1,500",
          formSubmitted: "300",
          fsr: "20%",
        },
        {
          device: "Tablet",
          visitors: "1,200",
          formSubmitted: "180",
          fsr: "10%",
        },
      ],
    },
    topPages: {
      title: "Top pages",
      columns: [
        { key: "page", label: "Pages" },
        { key: "visitors", label: "Visitors", align: "right" },
      ],
      rows: [
        { page: "/", visitors: "2.8K" },
        { page: "/contact", visitors: "5" },
        { page: "/privacy-policy", visitors: "1" },
      ],
    },
    trafficByLocation: {
      title: "Traffic by location",
      columns: [
        { key: "city", label: "City" },
        { key: "visitors", label: "Visitors" },
        { key: "formSubmitted", label: formSubmitted },
        { key: "fsr", label: rate },
      ],
      rows: [
        {
          city: "New York",
          visitors: "2,000",
          formSubmitted: "400",
          fsr: "20%",
        },
        {
          city: "Chicago",
          visitors: "1,500",
          formSubmitted: "300",
          fsr: "20%",
        },
        {
          city: "Dallas",
          visitors: "1,200",
          formSubmitted: "180",
          fsr: "10%",
        },
      ],
    },
    referrers: [
      { domain: "google.com", visitors: "19" },
      { domain: "bing.com", visitors: "2" },
    ],
    utmByParam: [],
    utmParameters: [],
  }
}
