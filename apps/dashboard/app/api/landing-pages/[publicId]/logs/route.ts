import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { listLandingPageAuditLogs } from "@/lib/server/landing-audit-log"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"

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
  const row = await getActiveLandingPageForActor(actor.id, publicId)
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const items = await listLandingPageAuditLogs(row.id)

  return NextResponse.json({ items })
}
