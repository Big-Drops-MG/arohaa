import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { markNotificationRead } from "@/lib/server/notifications"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"

export async function PATCH(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limited = await enforceLandingApiRateLimit(actor.id)
  if (limited) return limited

  const { id } = await context.params
  const updated = await markNotificationRead(actor.id, id)

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
