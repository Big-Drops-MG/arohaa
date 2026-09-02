import { NextResponse } from "next/server"
import {
  countUnreadNotifications,
  listUserNotifications,
  syncAnalyticsAlertNotifications,
} from "@/lib/server/notifications"
import { route } from "@/lib/server/route"

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "collection",
    rateLimit: "landing",
  },
  async ({ actor }) => {
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
)
