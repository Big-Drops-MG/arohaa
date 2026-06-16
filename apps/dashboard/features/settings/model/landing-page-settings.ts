import type { OverviewLandingFormType } from "@/features/overview/model/overview"

export type LandingPageRecord = {
  id: string
  workspaceId: string
  publicId: string
  brandName: string
  landingPageUrl: string
  normalizedUrl: string
  origin: string
  hostname: string
  status: string
  sdkInstallStatus: string
  verificationMethod: string | null
  verifiedAt: string | null
  lastSeenAt: string | null
  lastEventAt: string | null
  formType: OverviewLandingFormType
  faviconUrl: string | null
  notes: string | null
  isLive: boolean
  createdAt: string
  updatedAt: string
}

export type LandingPageSettingsData = {
  landingPage: LandingPageRecord
  sdkSnippetHtml: string
  htmlVerificationMetaTag: string | null
  ingestApiBase: string | null
  sdkScriptUrl: string
}
