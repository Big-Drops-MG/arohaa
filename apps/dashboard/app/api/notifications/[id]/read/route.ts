import { NextResponse } from "next/server"
import { markNotificationRead } from "@/lib/server/notifications"
import { route } from "@/lib/server/route"

export const PATCH = route(
  {
    permission: "landing_pages.read",
    actor: "write",
    tab: "collection",
    rateLimit: "landing",
  },
  async ({ actor, params }) => {
    const updated = await markNotificationRead(actor.id, params.id!)

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  }
)
