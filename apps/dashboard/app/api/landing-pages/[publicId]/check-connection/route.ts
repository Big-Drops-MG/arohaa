import { NextResponse } from "next/server"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import { writeLandingPageAuditLog } from "@/lib/server/landing-audit-log"
import { route } from "@/lib/server/route"

const RECENT_MS = 2 * 60 * 1000

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

    const now = Date.now()
    const lastSeen = row.lastSeenAt?.getTime() ?? 0
    const connected =
      row.verificationMethod === "html_meta" ||
      row.sdkInstallStatus === "detected" ||
      row.status === "verified" ||
      (lastSeen > 0 && now - lastSeen <= RECENT_MS)

    await writeLandingPageAuditLog({
      actorUserId: actor.id,
      landingPageId: row.id,
      action: "check_connection",
      beforePayload: {
        sdkInstallStatus: row.sdkInstallStatus,
        status: row.status,
        lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
      },
      afterPayload: {
        connected,
        sdkInstallStatus: row.sdkInstallStatus,
        status: row.status,
        lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
      },
      traceId: traceIdFrom(request),
    })

    return NextResponse.json({
      connected,
      sdkInstallStatus: row.sdkInstallStatus,
      lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
      status: row.status,
      verifiedAt: row.verifiedAt?.toISOString() ?? null,
      verificationMethod: row.verificationMethod,
    })
  }
)
