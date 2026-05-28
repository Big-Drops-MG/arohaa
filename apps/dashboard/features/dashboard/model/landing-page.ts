export type LandingPageMetric = {
  label: string
  value: string
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
  metrics: LandingPageMetric[]
}

export const emptyLandingPageMetrics: LandingPageMetric[] = [
  { label: "Active Users", value: "0" },
  { label: "Form Submissions", value: "0" },
  { label: "Bounce Rate", value: "0%" },
]
