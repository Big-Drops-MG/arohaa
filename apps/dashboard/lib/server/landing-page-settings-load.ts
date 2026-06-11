import { notFound } from "next/navigation"
import { parseOverviewLandingFormType } from "@/features/overview/model/overview"
import type { LandingPageSettingsData } from "@/features/settings/model/landing-page-settings"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { toLandingPageRecord } from "@/lib/server/landing-page-json"
import {
  buildHtmlVerificationMetaTag,
  buildLandingSdkScriptTag,
  resolveLandingSdkEnv,
} from "@/lib/server/landing-snippet"
import { getActiveLandingPageByPublicId } from "@/lib/server/landing-pages-store"

export async function loadLandingPageSettingsData(
  landingPagePublicId: string
): Promise<LandingPageSettingsData> {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()

  const row = await getActiveLandingPageByPublicId(landingPagePublicId)
  if (!row) notFound()

  const { ingestApiBase, sdkScriptUrl } = resolveLandingSdkEnv()
  const formType = parseOverviewLandingFormType(row.formType)

  const sdkSnippetHtml =
    ingestApiBase != null
      ? buildLandingSdkScriptTag({
          sdkScriptUrl,
          ingestApiBase,
          workspaceUuid: row.id,
          publicLandingId: row.publicId,
          pageHostname: row.hostname,
          formType,
        })
      : ""

  const htmlVerificationMetaTag = row.htmlVerificationToken
    ? buildHtmlVerificationMetaTag(row.htmlVerificationToken)
    : null

  return {
    landingPage: toLandingPageRecord(row),
    sdkSnippetHtml,
    htmlVerificationMetaTag,
    ingestApiBase,
    sdkScriptUrl,
  }
}
