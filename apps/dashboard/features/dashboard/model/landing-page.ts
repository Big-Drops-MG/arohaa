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
  /** Optional channel tag from project settings (email | social). */
  channelType: "email" | "social" | null
  /** Label held in the experiment this page participates in, if any. */
  variantLabel: string | null
  experimentName: string | null
  /** Brand name of the project that owns the experiment, used on the card badge. */
  experimentGroupName: string | null
}
