import type { OverviewLandingFormType } from "@/features/overview/model/overview"
import type { EventTrackingKpiSegmentId } from "@/features/event-tracking/model/event-tracking"

export function eventTrackingSubmissionColumnLabels(
  formType: OverviewLandingFormType
) {
  if (formType === "none") {
    return {
      formSubmitted: "Service Clicked",
      share: "% Share",
    }
  }
  const isZip = formType === "zip"
  return {
    formSubmitted: isZip ? "Zip Submitted" : "Form Submitted",
    share: "% Share",
  }
}

export function eventTrackingSubmissionOverTimeTitle(
  formType: OverviewLandingFormType
): string {
  if (formType === "none") return "Service Clicks Over Time"
  return formType === "zip"
    ? "Zip Submission Over Time"
    : "Form Submission Over Time"
}

export function eventTrackingKpiSegmentOrder(
  formType: OverviewLandingFormType
): EventTrackingKpiSegmentId[] {
  if (formType === "none") {
    return ["form-submitted", "call-clicks"]
  }
  if (formType === "zip") {
    return ["call-clicks", "form-submitted"]
  }
  return ["form-submitted", "call-clicks", "form-start"]
}

export function eventTrackingKpiSegmentLabel(
  formType: OverviewLandingFormType,
  id: EventTrackingKpiSegmentId
): string {
  if (id === "form-submitted") {
    if (formType === "none") return "Service Clicks"
    return formType === "zip" ? "Zip Submitted" : "Form Submitted"
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
