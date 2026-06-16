import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { markAllNotificationsRead } from "@/lib/server/notifications"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"

export async function POST(_request: NextRequest) {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limited = await enforceLandingApiRateLimit(actor.id)
  if (limited) return limited

  const marked = await markAllNotificationsRead(actor.id)

  return NextResponse.json({ ok: true, marked })
}
