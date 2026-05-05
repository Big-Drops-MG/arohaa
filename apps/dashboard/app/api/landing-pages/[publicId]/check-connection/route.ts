import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageInWorkspace } from "@/lib/server/landing-pages-store"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"
import { getOrCreateOwnerWorkspace } from "@/lib/server/resolve-workspace"

const RECENT_MS = 2 * 60 * 1000

export async function POST(
  _request: NextRequest,
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

  const now = Date.now()
  const lastSeen = row.lastSeenAt?.getTime() ?? 0
  const connected =
    row.verificationMethod === "html_meta" ||
    row.sdkInstallStatus === "detected" ||
    row.status === "verified" ||
    (lastSeen > 0 && now - lastSeen <= RECENT_MS)

  return NextResponse.json({
    connected,
    sdkInstallStatus: row.sdkInstallStatus,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    status: row.status,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    verificationMethod: row.verificationMethod,
  })
}
