import { NextResponse } from "next/server"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import { listLandingPageAuditLogs } from "@/lib/server/landing-audit-log"
import { route } from "@/lib/server/route"

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "settings",
    rateLimit: "landing",
  },
  async ({ actor, params }) => {
    const row = await getActiveLandingPageForActor(actor.id, params.publicId!)
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const items = await listLandingPageAuditLogs(row.id)
    return NextResponse.json({ items })
  }
)
