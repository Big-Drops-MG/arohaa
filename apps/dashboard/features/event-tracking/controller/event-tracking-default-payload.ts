import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import type { OverviewLandingFormType } from "@/features/overview/model/overview"
import type {
  EventTrackingByDateRange,
  EventTrackingKpiSegment,
  EventTrackingKpiSegmentsByDateRange,
  EventTrackingSubmissionByDateRange,
  EventTrackingSubmissionRow,
  EventTrackingValuesByMetric,
} from "@/features/event-tracking/model/event-tracking"

const RANGE_IDS: OverviewDateRangeId[] = [
  "24h",
  "7d",
  "30d",
  "3m",
  "12m",
  "24m",
]

function mockEventTrackingStatsForRange(
  rangeId: OverviewDateRangeId
): EventTrackingValuesByMetric {
  const byRange: Record<OverviewDateRangeId, EventTrackingValuesByMetric> = {
    "24h": {
      "total-events": "180",
      "call-clicks": "45",
      "form-submitted": "32",
      "success-rate": "5.2%",
    },
    "7d": {
      "total-events": "1,240",
      "call-clicks": "340",
      "form-submitted": "900",
      "success-rate": "6.5%",
    },
    "30d": {
      "total-events": "5,200",
      "call-clicks": "1,420",
      "form-submitted": "3,800",
      "success-rate": "7.1%",
    },
    "3m": {
      "total-events": "14,800",
      "call-clicks": "4,100",
      "form-submitted": "10,200",
      "success-rate": "6.9%",
    },
    "12m": {
      "total-events": "58,200",
      "call-clicks": "16,100",
      "form-submitted": "40,500",
      "success-rate": "7.4%",
    },
    "24m": {
      "total-events": "112,000",
      "call-clicks": "31,000",
      "form-submitted": "78,000",
      "success-rate": "7.0%",
    },
  }

  return byRange[rangeId]
}

function mockSubmissionRowsForRange(
  rangeId: OverviewDateRangeId
): EventTrackingSubmissionRow[] {
  const byRange: Record<OverviewDateRangeId, EventTrackingSubmissionRow[]> = {
    "24h": [
      { date: "12 AM", formSubmitted: "4" },
      { date: "4 AM", formSubmitted: "3" },
      { date: "8 AM", formSubmitted: "7" },
      { date: "12 PM", formSubmitted: "10" },
      { date: "4 PM", formSubmitted: "5" },
      { date: "8 PM", formSubmitted: "3" },
    ],
    "7d": [
      { date: "Apr 1", formSubmitted: "140" },
      { date: "Apr 2", formSubmitted: "175" },
      { date: "Apr 3", formSubmitted: "117" },
      { date: "Apr 4", formSubmitted: "117" },
      { date: "Apr 5", formSubmitted: "117" },
      { date: "Apr 6", formSubmitted: "117" },
      { date: "Apr 7", formSubmitted: "117" },
    ],
    "30d": [
      { date: "Week 1", formSubmitted: "920" },
      { date: "Week 2", formSubmitted: "950" },
      { date: "Week 3", formSubmitted: "940" },
      { date: "Week 4", formSubmitted: "990" },
    ],
    "3m": [
      { date: "Feb", formSubmitted: "3,200" },
      { date: "Mar", formSubmitted: "3,400" },
      { date: "Apr", formSubmitted: "3,600" },
    ],
    "12m": [
      { date: "Jan", formSubmitted: "6,200" },
      { date: "Mar", formSubmitted: "6,700" },
      { date: "May", formSubmitted: "6,850" },
      { date: "Jul", formSubmitted: "7,000" },
      { date: "Sep", formSubmitted: "6,950" },
      { date: "Nov", formSubmitted: "6,800" },
    ],
    "24m": [
      { date: "2024 Q1", formSubmitted: "12,500" },
      { date: "2024 Q2", formSubmitted: "13,100" },
      { date: "2024 Q3", formSubmitted: "13,800" },
      { date: "2024 Q4", formSubmitted: "14,200" },
      { date: "2025 Q1", formSubmitted: "11,900" },
      { date: "2025 Q2", formSubmitted: "12,500" },
    ],
  }

  return byRange[rangeId]
}

function mockKpiSegmentsForRange(
  formType: OverviewLandingFormType,
  rangeId: OverviewDateRangeId
): EventTrackingKpiSegment[] {
  if (formType === "zip") {
    const byRange: Record<OverviewDateRangeId, EventTrackingKpiSegment[]> = {
      "24h": [
        { id: "call-clicks", value: 45 },
        { id: "zip-submit", value: 32 },
      ],
      "7d": [
        { id: "call-clicks", value: 340 },
        { id: "zip-submit", value: 900 },
      ],
      "30d": [
        { id: "call-clicks", value: 1420 },
        { id: "zip-submit", value: 3800 },
      ],
      "3m": [
        { id: "call-clicks", value: 4100 },
        { id: "zip-submit", value: 10200 },
      ],
      "12m": [
        { id: "call-clicks", value: 16100 },
        { id: "zip-submit", value: 40500 },
      ],
      "24m": [
        { id: "call-clicks", value: 31000 },
        { id: "zip-submit", value: 78000 },
      ],
    }
    return byRange[rangeId]
  }

  const byRange: Record<OverviewDateRangeId, EventTrackingKpiSegment[]> = {
    "24h": [
      { id: "form-submitted", value: 22 },
      { id: "call-clicks", value: 45 },
      { id: "form-start", value: 8 },
    ],
    "7d": [
      { id: "form-submitted", value: 660 },
      { id: "call-clicks", value: 250 },
      { id: "form-start", value: 90 },
    ],
    "30d": [
      { id: "form-submitted", value: 2800 },
      { id: "call-clicks", value: 1050 },
      { id: "form-start", value: 380 },
    ],
    "3m": [
      { id: "form-submitted", value: 8200 },
      { id: "call-clicks", value: 3100 },
      { id: "form-start", value: 1100 },
    ],
    "12m": [
      { id: "form-submitted", value: 32400 },
      { id: "call-clicks", value: 12200 },
      { id: "form-start", value: 4300 },
    ],
    "24m": [
      { id: "form-submitted", value: 62400 },
      { id: "call-clicks", value: 23500 },
      { id: "form-start", value: 8200 },
    ],
  }

  return byRange[rangeId]
}

export function defaultEventTrackingByDateRange(): EventTrackingByDateRange {
  return Object.fromEntries(
    RANGE_IDS.map((id) => [id, {}])
  ) as EventTrackingByDateRange
}

const emptySubmissionByDateRange: EventTrackingSubmissionByDateRange = {
  "24h": [],
  "7d": [],
  "30d": [],
  "3m": [],
  "12m": [],
  "24m": [],
}

const emptyKpiSegmentsByDateRange: EventTrackingKpiSegmentsByDateRange = {
  "24h": [],
  "7d": [],
  "30d": [],
  "3m": [],
  "12m": [],
  "24m": [],
}

export function defaultEventTrackingSubmissionByDateRange(): EventTrackingSubmissionByDateRange {
  return emptySubmissionByDateRange
}

export function defaultEventTrackingKpiSegmentsByDateRange(): EventTrackingKpiSegmentsByDateRange {
  return emptyKpiSegmentsByDateRange
}

export function mockEventTrackingByDateRange(): EventTrackingByDateRange {
  return Object.fromEntries(
    RANGE_IDS.map((id) => [id, mockEventTrackingStatsForRange(id)])
  ) as EventTrackingByDateRange
}

export function mockEventTrackingSubmissionByDateRange(): EventTrackingSubmissionByDateRange {
  return Object.fromEntries(
    RANGE_IDS.map((id) => [id, mockSubmissionRowsForRange(id)])
  ) as EventTrackingSubmissionByDateRange
}

export function mockEventTrackingKpiSegmentsByDateRange(
  formType: OverviewLandingFormType
): EventTrackingKpiSegmentsByDateRange {
  return Object.fromEntries(
    RANGE_IDS.map((id) => [id, mockKpiSegmentsForRange(formType, id)])
  ) as EventTrackingKpiSegmentsByDateRange
}
