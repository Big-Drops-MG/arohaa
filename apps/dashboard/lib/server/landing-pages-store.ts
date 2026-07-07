import type { InferSelectModel } from "drizzle-orm"
import { and, eq, isNull } from "drizzle-orm"
import { db, landingPages } from "@workspace/database"
import { getOrCreateOwnerWorkspace } from "./resolve-workspace"

export type LandingPageRow = InferSelectModel<typeof landingPages>

/** Non-deleted landing page in the actor's workspace. */
export async function getActiveLandingPageForActor(
  actorId: string,
  publicId: string
): Promise<LandingPageRow | null> {
  const ws = await getOrCreateOwnerWorkspace(actorId)
  return getActiveLandingPageInWorkspace(ws.id, publicId)
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
