import type { OverviewLandingFormType } from "@/features/overview/model/overview"
import type { EventTrackingKpiSegmentId } from "@/features/event-tracking/model/event-tracking"

export function eventTrackingSubmissionColumnLabels(
  formType: OverviewLandingFormType
) {
  const isZip = formType === "zip"
  return {
    formSubmitted: isZip ? "Zip Submitted" : "Form Submitted",
    share: "% Share",
  }
}

export function eventTrackingSubmissionOverTimeTitle(
  formType: OverviewLandingFormType
): string {
  return formType === "zip"
    ? "Zip Submission Over Time"
    : "Form Submission Over Time"
}

export function eventTrackingKpiSegmentOrder(
  formType: OverviewLandingFormType
): EventTrackingKpiSegmentId[] {
  if (formType === "zip") {
    return ["call-clicks", "form-submitted"]
  }
  return ["form-submitted", "call-clicks", "form-start"]
}

export function eventTrackingKpiSegmentLabel(
  formType: OverviewLandingFormType,
  id: EventTrackingKpiSegmentId
): string {
  const isZip = formType === "zip"
  if (id === "form-submitted") {
    return isZip ? "Zip Submitted" : "Form Submitted"
  }
  if (id === "call-clicks") return "Call Clicks"
  if (id === "zip-submit") return "Zip Submit"
  return "Form Start"
}

export const EVENT_TRACKING_KPI_SEGMENT_COLORS: Record<
  EventTrackingKpiSegmentId,
  string
> = {
  "form-submitted": "#d4d4d4",
  "call-clicks": "#525252",
  "zip-submit": "#0f172a",
  "form-start": "#0f172a",
}
