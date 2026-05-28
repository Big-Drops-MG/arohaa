import { eq } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { db, landingPageAuditLogs, landingPages } from "@workspace/database"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageInWorkspace } from "@/lib/server/landing-pages-store"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"
import { getOrCreateOwnerWorkspace } from "@/lib/server/resolve-workspace"

function traceIdFrom(request: NextRequest): string | null {
  return request.headers.get("x-trace-id")?.trim() || null
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ publicId: string }> }
) {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limited = await enforceLandingApiRateLimit(actor.id)
  if (limited) return limited

  const ws = await getOrCreateOwnerWorkspace(actor.id)

  const { publicId } = await context.params
  const row = await getActiveLandingPageInWorkspace(ws.id, publicId)
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const now = new Date()
  await db
    .update(landingPages)
    .set({
      deletedAt: now,
      updatedByUserId: actor.id,
      updatedAt: now,
      status: "archived",
      sdkInstallStatus: "failed",
    })
    .where(eq(landingPages.id, row.id))

  await db.insert(landingPageAuditLogs).values({
    actorUserId: actor.id,
    landingPageId: row.id,
    action: "archive",
    beforePayload: {
      deletedAt: null,
      status: row.status,
      workspaceId: row.workspaceId,
    },
    afterPayload: {
      deletedAt: now.toISOString(),
      status: "archived",
      workspaceId: row.workspaceId,
    },
    traceId: traceIdFrom(request),
  })

  return NextResponse.json({ ok: true })
}
