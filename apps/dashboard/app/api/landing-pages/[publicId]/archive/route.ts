import { NextResponse } from "next/server"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import { scrubExperimentsAndSoftDeleteLandingPage } from "@/lib/server/landing-page-soft-delete"
import { route } from "@/lib/server/route"

function traceIdFrom(request: Request): string | null {
  return request.headers.get("x-trace-id")?.trim() || null
}

export const POST = route(
  {
    permission: "landing_pages.write",
    actor: "write",
    tab: "settings",
    section: "project",
    rateLimit: "landing",
  },
  async ({ actor, params, request }) => {
    const row = await getActiveLandingPageForActor(actor.id, params.publicId!)
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const archived = await scrubExperimentsAndSoftDeleteLandingPage(
      row,
      actor.id,
      {
        action: "archive",
        actorUserId: actor.id,
        traceId: traceIdFrom(request),
        beforePayload: {
          deletedAt: null,
          status: row.status,
          brandName: row.brandName,
          workspaceId: row.workspaceId,
        },
        afterPayload: (deletedAt) => ({
          deletedAt: deletedAt.toISOString(),
          status: "archived",
          workspaceId: row.workspaceId,
        }),
      }
    )
    if (!archived.ok) {
      return NextResponse.json(
        { error: archived.error },
        { status: archived.status }
      )
    }

    return NextResponse.json({ ok: true })
  }
)
