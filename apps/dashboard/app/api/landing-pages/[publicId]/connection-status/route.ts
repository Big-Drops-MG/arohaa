import { NextResponse } from "next/server"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
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
)
