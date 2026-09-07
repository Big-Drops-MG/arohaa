import type { InferSelectModel } from "drizzle-orm"
import { and, eq, isNull, or } from "drizzle-orm"
import { db, landingPages, users } from "@workspace/database"
import { canAccessProject, getActorAccess } from "@/lib/server/external-access"

export type LandingPageRow = InferSelectModel<typeof landingPages>

/** Non-deleted landing page visible to the actor (privilege-filtered for externals). */
export async function getActiveLandingPageForActor(
  actorId: string,
  routeSegment: string
): Promise<LandingPageRow | null> {
  const row = await getActiveLandingPageByRouteSegment(routeSegment)
  if (!row) return null

  const actor = await db.query.users.findFirst({
    where: eq(users.id, actorId),
  })
  if (!actor) return null

  const access = await getActorAccess(actor)
  if (!canAccessProject(access, row.publicId)) return null

  return row
}

export async function getActiveLandingPageByRouteSegment(
  routeSegment: string
): Promise<LandingPageRow | null> {
  const rows = await db
    .select()
    .from(landingPages)
    .where(
      and(
        or(
          eq(landingPages.slug, routeSegment),
          eq(landingPages.publicId, routeSegment)
        ),
        isNull(landingPages.deletedAt)
      )
    )
    .limit(1)

  return rows[0] ?? null
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
