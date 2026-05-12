export type LandingPageMetric = {
  label: string
  value: string
}

export type LandingPageListItem = {
  publicId: string
  brandName: string
  landingPageUrl: string
  metrics: LandingPageMetric[]
}

export const emptyLandingPageMetrics: LandingPageMetric[] = [
  { label: "Active Users", value: "0" },
  { label: "Form Submissions", value: "0" },
  { label: "Bounce Rate", value: "0%" },
]
