import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import {
  countUnreadNotifications,
  listUserNotifications,
  syncAnalyticsAlertNotifications,
} from "@/lib/server/notifications"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"

export async function GET(_request: NextRequest) {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limited = await enforceLandingApiRateLimit(actor.id)
  if (limited) return limited

  try {
    await syncAnalyticsAlertNotifications(actor.id)
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[notifications] analytics sync failed", err)
    }
  }

  const [items, unreadCount] = await Promise.all([
    listUserNotifications(actor.id),
    countUnreadNotifications(actor.id),
  ])

  return NextResponse.json({ items, unreadCount })
}
