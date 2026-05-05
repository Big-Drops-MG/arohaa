import { eq } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { db, landingPageAuditLogs, landingPages } from "@workspace/database"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageInWorkspace } from "@/lib/server/landing-pages-store"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"
import { getOrCreateOwnerWorkspace } from "@/lib/server/resolve-workspace"
import {
  fetchLandingHtmlForVerification,
  landingHtmlIncludesVerificationToken,
} from "@/lib/server/safe-fetch-landing-verify"

function traceIdFrom(request: NextRequest): string | null {
  return request.headers.get("x-trace-id")?.trim() || null
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ publicId: string }> }
) {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limited = await enforceLandingApiRateLimit(actor.id)
  if (limited) return limited

  const ws = await getOrCreateOwnerWorkspace(actor.id)
  const { publicId } = await context.params
  const row = await getActiveLandingPageInWorkspace(ws.id, publicId)
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const token = row.htmlVerificationToken?.trim()
  if (!token) {
    return NextResponse.json(
      { error: "No HTML verification token configured for this landing page." },
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

  await db.insert(landingPageAuditLogs).values({
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
