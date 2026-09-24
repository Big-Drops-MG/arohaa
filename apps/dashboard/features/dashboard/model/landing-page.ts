export type LandingPageMetric = {
  label: string
  value: string
}

export function submissionMetricLabel(formType: string): string {
  if (formType === "none") return "Service Clicks"
  return formType === "zip" ? "Zip Submits" : "Form Submits"
}

/** Drops the scheme and trailing slash so cards read as a hostname, not a URL. */
export function landingPageDisplayUrl(landingPageUrl: string): string {
  return landingPageUrl.replace(/^https?:\/\//i, "").replace(/\/+$/, "")
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
  slug: string
  brandName: string
  faviconUrl: string | null
}

export type LandingPageListItem = {
  publicId: string
  slug: string
  brandName: string
  brand: string | null
  landingPageUrl: string
  faviconUrl: string | null
  isLive: boolean
  metrics: LandingPageMetric[]
  channelType: "email" | "social" | null
  variantLabel: string | null
  experimentName: string | null
  experimentGroupName: string | null
  experimentId: string | null
  hubPublicId: string | null
}
