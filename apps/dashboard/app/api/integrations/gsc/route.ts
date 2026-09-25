import { NextResponse } from "next/server"
import {
  db,
  decryptVapidPrivateKey,
  eq,
  listGscSites,
  refreshGscAccessToken,
  workspaceGscConnections,
} from "@workspace/database"
import { requireWritableLandingPageActor } from "@/lib/server/external-access"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import { route } from "@/lib/server/route"

export const GET = route(
  {
    permission: "landing_pages.write",
    actor: "write",
    tab: "seo",
    rateLimit: "landing",
  },
  async ({ actor, request }) => {
    const writable = await requireWritableLandingPageActor()
    if (!writable) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const publicId = new URL(request.url).searchParams.get("public_id")?.trim()
    if (!publicId) {
      return NextResponse.json({ error: "public_id required" }, { status: 400 })
    }

    const lp = await getActiveLandingPageForActor(actor.id, publicId)
    if (!lp) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const connection = await db.query.workspaceGscConnections.findFirst({
      where: eq(workspaceGscConnections.workspaceId, lp.workspaceId),
    })
    if (!connection || connection.status !== "active") {
      return NextResponse.json({
        connected: false,
        email: null,
        sites: [] as Array<{ siteUrl: string; permissionLevel: string }>,
        gscSiteUrl: lp.gscSiteUrl ?? null,
        gscLastSyncedAt: lp.gscLastSyncedAt?.toISOString() ?? null,
      })
    }

    try {
      const refreshToken = decryptVapidPrivateKey(
        connection.refreshTokenEncrypted
      )
      const accessToken = await refreshGscAccessToken(refreshToken)
      const sites = await listGscSites(accessToken)
      return NextResponse.json({
        connected: true,
        email: connection.googleAccountEmail,
        sites,
        gscSiteUrl: lp.gscSiteUrl ?? null,
        gscLastSyncedAt: lp.gscLastSyncedAt?.toISOString() ?? null,
      })
    } catch (err) {
      console.error("GSC sites list failed", err)
      return NextResponse.json(
        {
          connected: true,
          email: connection.googleAccountEmail,
          sites: [],
          gscSiteUrl: lp.gscSiteUrl ?? null,
          gscLastSyncedAt: lp.gscLastSyncedAt?.toISOString() ?? null,
          error: "Failed to list Search Console properties",
        },
        { status: 502 }
      )
    }
  }
)

export const DELETE = route(
  {
    permission: "landing_pages.write",
    actor: "write",
    tab: "seo",
    rateLimit: "landing",
  },
  async ({ actor, request }) => {
    const writable = await requireWritableLandingPageActor()
    if (!writable) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const publicId = new URL(request.url).searchParams.get("public_id")?.trim()
    if (!publicId) {
      return NextResponse.json({ error: "public_id required" }, { status: 400 })
    }

    const lp = await getActiveLandingPageForActor(actor.id, publicId)
    if (!lp) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await db
      .delete(workspaceGscConnections)
      .where(eq(workspaceGscConnections.workspaceId, lp.workspaceId))

    return NextResponse.json({ ok: true })
  }
)
