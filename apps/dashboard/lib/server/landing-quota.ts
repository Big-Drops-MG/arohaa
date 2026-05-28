import { and, count, eq, isNull } from "drizzle-orm"
import { db, landingPages } from "@workspace/database"
import { NextResponse } from "next/server"

function maxLandingPagesPerWorkspace(): number {
  const raw = process.env.LANDING_PAGES_MAX_PER_WORKSPACE?.trim()
  const n = raw ? Number.parseInt(raw, 10) : 100
  return Number.isFinite(n) && n > 0 ? n : 100
}

export async function enforceLandingQuota(
  workspaceId: string
): Promise<NextResponse | null> {
  const max = maxLandingPagesPerWorkspace()
  const [row] = await db
    .select({ n: count() })
    .from(landingPages)
    .where(
      and(
        eq(landingPages.workspaceId, workspaceId),
        isNull(landingPages.deletedAt)
      )
    )

  const n = Number(row?.n ?? 0)
  if (!Number.isFinite(n) || n < max) {
    return null
  }

  return NextResponse.json(
    {
      error: `Landing page limit reached (${max} per workspace).`,
    },
    { status: 403 }
  )
}
