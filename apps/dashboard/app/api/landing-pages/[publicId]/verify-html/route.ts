import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { db, landingPages } from "@workspace/database"
import { writeLandingPageAuditLog } from "@/lib/server/landing-audit-log"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import { route } from "@/lib/server/route"
import {
  fetchLandingHtmlForVerification,
  landingHtmlIncludesVerificationToken,
} from "@/lib/server/safe-fetch-landing-verify"

function traceIdFrom(request: Request): string | null {
  return request.headers.get("x-trace-id")?.trim() || null
}

export const POST = route(
  {
    permission: "landing_pages.write",
    actor: "write",
    tab: "settings",
    section: "tracking",
    rateLimit: "landing",
  },
  async ({ actor, params, request }) => {
    const row = await getActiveLandingPageForActor(actor.id, params.publicId!)
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const token = row.htmlVerificationToken?.trim()
    if (!token) {
      return NextResponse.json(
        {
          error: "No HTML verification token configured for this landing page.",
        },
        { status: 400 }
      )
    }

    const fetched = await fetchLandingHtmlForVerification(
      row.landingPageUrl,
      row.hostname
    )
    if (!fetched.ok) {
      return NextResponse.json(
        { error: "Could not fetch landing page", detail: fetched.reason },
        { status: 422 }
      )
    }

    if (!landingHtmlIncludesVerificationToken(fetched.text, token)) {
      return NextResponse.json(
        {
          error:
            "Verification token not found on the page. Add the meta tag from the dashboard and publish the page.",
        },
        { status: 422 }
      )
    }

    const now = new Date()
    await db
      .update(landingPages)
      .set({
        sdkInstallStatus: "detected",
        status: "verified",
        verifiedAt: row.verifiedAt ?? now,
        verificationMethod: "html_meta",
        lastSeenAt: now,
        updatedAt: now,
        updatedByUserId: actor.id,
      })
      .where(eq(landingPages.id, row.id))

    await writeLandingPageAuditLog({
      actorUserId: actor.id,
      landingPageId: row.id,
      action: "verify_html",
      beforePayload: {
        verificationMethod: row.verificationMethod,
        status: row.status,
      },
      afterPayload: {
        verificationMethod: "html_meta",
        status: "verified",
      },
      traceId: traceIdFrom(request),
    })

    return NextResponse.json({
      ok: true,
      verificationMethod: "html_meta",
      status: "verified",
    })
  }
)
