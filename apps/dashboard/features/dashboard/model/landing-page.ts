export type LandingPageMetric = {
  label: string
  value: string
}

export function submissionMetricLabel(formType: string): string {
  return formType === "zip" ? "Zip Submits" : "Form Submissions"
}

export function emptyLandingPageMetrics(
  formType = "single"
): LandingPageMetric[] {
  return [
    { label: "Active Users", value: "0" },
    { label: submissionMetricLabel(formType), value: "0" },
    { label: "Bounce Rate", value: "0%" },
  ]
}

export type LandingPageNavItem = {
  publicId: string
  brandName: string
  faviconUrl: string | null
}

export type LandingPageListItem = {
  publicId: string
  brandName: string
  landingPageUrl: string
  faviconUrl: string | null
  isLive: boolean
  metrics: LandingPageMetric[]
}
