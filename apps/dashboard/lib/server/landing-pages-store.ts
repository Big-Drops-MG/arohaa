import type { InferSelectModel } from "drizzle-orm"
import { and, desc, eq, isNull, or } from "drizzle-orm"
import { db, landingPages, users } from "@workspace/database"
import {
  canAccessProject,
  getActorAccess,
  type ActorAccess,
} from "@/lib/server/external-access"
import { resolveCompanyWorkspace } from "@/lib/server/resolve-workspace"

export type LandingPageRow = InferSelectModel<typeof landingPages>

/** Filter rows by external privilege grants (internals see all). */
export function filterLandingPagesForAccess<T extends { publicId: string }>(
  rows: readonly T[],
  access: ActorAccess
): T[] {
  return rows.filter((row) => canAccessProject(access, row.publicId))
}

/** Active landing pages in the shared Company workspace (create target). */
export async function listActiveLandingPagesInCompanyWorkspace(): Promise<
  LandingPageRow[]
> {
  const company = await resolveCompanyWorkspace()
  return db
    .select()
    .from(landingPages)
    .where(
      and(
        eq(landingPages.workspaceId, company.id),
        isNull(landingPages.deletedAt)
      )
    )
    .orderBy(desc(landingPages.createdAt))
}

/**
 * Company-workspace pages visible to the actor.
 * Internals see the full company collection; externals are privilege-filtered.
 */
export async function listAccessibleLandingPagesForActor(actor: {
  id: string
  teamKind?: string | null
}): Promise<LandingPageRow[]> {
  const access = await getActorAccess(actor)
  const rows = await listActiveLandingPagesInCompanyWorkspace()
  return filterLandingPagesForAccess(rows, access)
}

/** Non-deleted landing page in Company workspace, visible to the actor. */
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

/**
 * Resolve by slug or publicId within the Company workspace only.
 * Personal/other workspaces are intentionally invisible to dashboard CRUD.
 */
export async function getActiveLandingPageByRouteSegment(
  routeSegment: string
): Promise<LandingPageRow | null> {
  const company = await resolveCompanyWorkspace()
  return getActiveLandingPageInWorkspaceBySegment(company.id, routeSegment)
}

export async function getActiveLandingPageByPublicId(
  publicId: string
): Promise<LandingPageRow | null> {
  const company = await resolveCompanyWorkspace()
  return getActiveLandingPageInWorkspace(company.id, publicId)
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

export async function getActiveLandingPageInWorkspaceBySegment(
  workspaceId: string,
  routeSegment: string
): Promise<LandingPageRow | null> {
  const rows = await db
    .select()
    .from(landingPages)
    .where(
      and(
        eq(landingPages.workspaceId, workspaceId),
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
