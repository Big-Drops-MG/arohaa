import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageInWorkspace } from "@/lib/server/landing-pages-store"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"
import { getOrCreateOwnerWorkspace } from "@/lib/server/resolve-workspace"

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

  const ws = await getOrCreateOwnerWorkspace(actor.id)

  const { publicId } = await context.params
  const row = await getActiveLandingPageInWorkspace(ws.id, publicId)
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({
    publicId: row.publicId,
    status: row.status,
    sdkInstallStatus: row.sdkInstallStatus,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    lastEventAt: row.lastEventAt?.toISOString() ?? null,
    verificationMethod: row.verificationMethod,
    workspaceId: row.workspaceId,
  })
}
