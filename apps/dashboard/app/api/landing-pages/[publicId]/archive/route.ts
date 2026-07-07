import { eq } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { db, landingPages } from "@workspace/database"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { writeLandingPageAuditLog } from "@/lib/server/landing-audit-log"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import { enforceLandingApiRateLimit } from "@/lib/server/rate-limit-landing"

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

  const { publicId } = await context.params
  const row = await getActiveLandingPageForActor(actor.id, publicId)
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

  await writeLandingPageAuditLog({
    actorUserId: actor.id,
    landingPageId: row.id,
    action: "archive",
    beforePayload: {
      deletedAt: null,
      status: row.status,
      brandName: row.brandName,
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
