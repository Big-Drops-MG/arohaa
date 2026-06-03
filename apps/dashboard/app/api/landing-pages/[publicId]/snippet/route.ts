import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageByPublicId } from "@/lib/server/landing-pages-store"
import {
  buildHtmlVerificationMetaTag,
  buildLandingSdkScriptTag,
  resolveLandingSdkEnv,
} from "@/lib/server/landing-snippet"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"
import { parseOverviewLandingFormType } from "@/features/overview/model/overview"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ publicId: string }> }
) {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limited = await enforceLandingApiRateLimit(actor.id)
  if (limited) return limited

  const { publicId } = await context.params
  const row = await getActiveLandingPageByPublicId(publicId)
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { ingestApiBase, sdkScriptUrl } = resolveLandingSdkEnv()
  if (!ingestApiBase) {
    return NextResponse.json(
      {
        error:
          "Server misconfiguration: set NEXT_PUBLIC_AROHAA_INGEST_API_BASE or INGEST_BASE_URL",
      },
      { status: 500 }
    )
  }

  const formType = parseOverviewLandingFormType(row.formType)

  const sdkSnippetHtml = buildLandingSdkScriptTag({
    sdkScriptUrl,
    ingestApiBase,
    workspaceUuid: row.id,
    publicLandingId: row.publicId,
    pageHostname: row.hostname,
    formType,
  })

  const htmlVerificationMetaTag = row.htmlVerificationToken
    ? buildHtmlVerificationMetaTag(row.htmlVerificationToken)
    : null

  return NextResponse.json({
    sdkSnippetHtml,
    htmlVerificationMetaTag,
    ingestApiBase,
    sdkScriptUrl,
  })
}
