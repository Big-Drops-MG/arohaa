import { NextResponse } from "next/server"
import { parseOverviewLandingFormType } from "@/features/overview/model/overview"
import {
  parseLandingPageServices,
  servicesForSdkSnippet,
} from "@/features/settings/model/landing-page-services"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import {
  buildHtmlVerificationMetaTag,
  buildLandingSdkScriptTag,
  resolveLandingSdkEnv,
} from "@/lib/server/landing-snippet"
import { route } from "@/lib/server/route"

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "settings",
    rateLimit: "landing",
  },
  async ({ actor, params }) => {
    const row = await getActiveLandingPageForActor(actor.id, params.publicId!)
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
    const services = servicesForSdkSnippet(
      parseLandingPageServices(row.metadata as Record<string, unknown> | null)
    )

    const sdkSnippetHtml = buildLandingSdkScriptTag({
      sdkScriptUrl,
      ingestApiBase,
      workspaceUuid: row.id,
      publicLandingId: row.publicId,
      pageHostname: row.hostname,
      formType,
      services,
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
)
