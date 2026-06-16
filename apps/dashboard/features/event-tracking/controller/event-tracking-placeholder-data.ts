import type { EventTrackingDashboardData } from "@/features/event-tracking/model/event-tracking"
import { eventTrackingKpisForFormType } from "@/features/event-tracking/utils/event-tracking-kpis-for-form-type"
import { withSubmissionShare } from "@/features/event-tracking/utils/event-tracking-submission-share"

export function getEventTrackingPlaceholderData(
  _landingPagePublicId: string
): EventTrackingDashboardData {
  void _landingPagePublicId

  const formType = "single" as const
  const kpiSource = {
    totalEvents: 1240,
    callClicks: 340,
    formStarted: 980,
    zipSubmit: 120,
    formSubmitted: 900,
    fsr: 6.5,
    zsr: 4.2,
  }

  return {
    formType,
    dateRangeOptions: [
      { id: "24h", label: "Last 24 hours" },
      { id: "7d", label: "Last 7 days" },
      { id: "30d", label: "Last 30 days" },
      { id: "3m", label: "Last 3 months" },
      { id: "12m", label: "Last 12 months" },
      { id: "24m", label: "Last 24 months" },
    ],
    defaultDateRangeId: "7d",
    kpis: eventTrackingKpisForFormType(formType, kpiSource),
    submissionRows: withSubmissionShare([
      { date: "Apr 1", formSubmitted: "120", fsr: "5.5%" },
      { date: "Apr 2", formSubmitted: "150", fsr: "6.2%" },
      { date: "Apr 3", formSubmitted: "100", fsr: "4.8%" },
      { date: "Apr 4", formSubmitted: "100", fsr: "4.8%" },
      { date: "Apr 5", formSubmitted: "100", fsr: "4.8%" },
      { date: "Apr 6", formSubmitted: "100", fsr: "4.8%" },
      { date: "Apr 7", formSubmitted: "100", fsr: "4.8%" },
    ]),
    kpiSegments: [
      { id: "form-submitted", value: 900 },
      { id: "call-clicks", value: 340 },
      { id: "form-start", value: 980 },
    ],
    pieSegments: [],
  }
}
