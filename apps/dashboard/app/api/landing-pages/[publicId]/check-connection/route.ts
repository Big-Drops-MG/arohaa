import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { writeLandingPageAuditLog } from "@/lib/server/landing-audit-log"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"

const RECENT_MS = 2 * 60 * 1000

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

  const { publicId } = await context.params
  const row = await getActiveLandingPageForActor(actor.id, publicId)
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
