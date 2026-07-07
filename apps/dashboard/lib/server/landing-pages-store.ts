import type { InferSelectModel } from "drizzle-orm"
import { and, eq, isNull } from "drizzle-orm"
import { db, landingPages } from "@workspace/database"

export type LandingPageRow = InferSelectModel<typeof landingPages>

/** Non-deleted landing page visible to any authenticated dashboard user. */
export async function getActiveLandingPageForActor(
  _actorId: string,
  publicId: string
): Promise<LandingPageRow | null> {
  return getActiveLandingPageByPublicId(publicId)
}

export async function getActiveLandingPageByPublicId(
  publicId: string
): Promise<LandingPageRow | null> {
  const rows = await db
    .select()
    .from(landingPages)
    .where(
      and(eq(landingPages.publicId, publicId), isNull(landingPages.deletedAt))
    )
    .limit(1)

  return rows[0] ?? null
}

export async function getActiveLandingPageInWorkspace(
  workspaceId: string,
  publicId: string
): Promise<LandingPageRow | null> {
  const rows = await db
    .select()
    .from(landingPages)
    .where(
      and(
        eq(landingPages.publicId, publicId),
        eq(landingPages.workspaceId, workspaceId),
        isNull(landingPages.deletedAt)
      )
    )
    .limit(1)

  return rows[0] ?? null
}
