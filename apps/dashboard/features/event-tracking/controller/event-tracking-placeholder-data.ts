import type { EventTrackingDashboardData } from "@/features/event-tracking/model/event-tracking"

export function getEventTrackingPlaceholderData(
  _landingPagePublicId: string
): EventTrackingDashboardData {
  void _landingPagePublicId

  return {
    dateRangeOptions: [
      { id: "24h", label: "Last 24 hours" },
      { id: "7d", label: "Last 7 days" },
      { id: "30d", label: "Last 30 days" },
      { id: "3m", label: "Last 3 months" },
      { id: "12m", label: "Last 12 months" },
      { id: "24m", label: "Last 24 months" },
    ],
    defaultDateRangeId: "7d",
    kpis: [
      { label: "Total Events", value: "1,240" },
      { label: "ZIP Submit", value: "120" },
      { label: "Call Clicks", value: "340" },
      { label: "Form Submitted", value: "900" },
      { label: "FSR", value: "6.5%" },
    ],
    submissionRows: [
      { date: "Apr 1", formSubmitted: "120", fsr: "5.5%" },
      { date: "Apr 2", formSubmitted: "150", fsr: "6.2%" },
      { date: "Apr 3", formSubmitted: "100", fsr: "4.8%" },
      { date: "Apr 4", formSubmitted: "100", fsr: "4.8%" },
      { date: "Apr 5", formSubmitted: "100", fsr: "4.8%" },
      { date: "Apr 6", formSubmitted: "100", fsr: "4.8%" },
      { date: "Apr 7", formSubmitted: "100", fsr: "4.8%" },
    ],
    pieSegments: [
      { name: "ZIP Submit", value: 9, color: "#111827" },
      { name: "Call Clicks", value: 25, color: "#6B7280" },
      { name: "Form Submitted", value: 66, color: "#D1D5DB" },
    ],
  }
}
