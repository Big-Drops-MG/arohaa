import { NextResponse } from "next/server"
import { markAllNotificationsRead } from "@/lib/server/notifications"
import { route } from "@/lib/server/route"

export const POST = route(
  {
    permission: "landing_pages.read",
    actor: "write",
    tab: "collection",
    rateLimit: "landing",
  },
  async ({ actor }) => {
    const marked = await markAllNotificationsRead(actor.id)

    return NextResponse.json({ ok: true, marked })
  }
)
