import { and, eq, isNull, sql } from "drizzle-orm"
import { db, landingPages, workspaces } from "@workspace/database"

export async function getOrCreateOwnerWorkspace(ownerUserId: string) {
  const existing = await db
    .select()
    .from(workspaces)
    .where(
      and(eq(workspaces.ownerUserId, ownerUserId), isNull(workspaces.deletedAt))
    )
    .limit(1)

  const row = existing[0]
  if (row) return row

  try {
    await db.insert(workspaces).values({
      ownerUserId,
      name: "Personal",
    })
  } catch (err) {
    const code = (err as { code?: string; cause?: { code?: string } })?.code
    const cause = (err as { cause?: { code?: string } })?.cause?.code ?? ""
    const unique = code === "23505" || cause === "23505"
    if (!unique) throw err
  }

  const again = await db
    .select()
    .from(workspaces)
    .where(
      and(eq(workspaces.ownerUserId, ownerUserId), isNull(workspaces.deletedAt))
    )
    .limit(1)

  const created = again[0]
  if (!created) {
    throw new Error("Could not resolve workspace for user")
  }
  return created
}

export async function resolveLandingPageWorkspace(actorUserId: string) {
  const shared = await db
    .select({
      id: workspaces.id,
      ownerUserId: workspaces.ownerUserId,
      name: workspaces.name,
      heatmapSampleRate: workspaces.heatmapSampleRate,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      deletedAt: workspaces.deletedAt,
      lpCount: sql<number>`count(${landingPages.id})`.mapWith(Number),
    })
    .from(workspaces)
    .innerJoin(
      landingPages,
      and(
        eq(landingPages.workspaceId, workspaces.id),
        isNull(landingPages.deletedAt)
      )
    )
    .where(isNull(workspaces.deletedAt))
    .groupBy(workspaces.id)
    .orderBy(sql`count(${landingPages.id}) desc`, workspaces.createdAt)
    .limit(1)

  const row = shared[0]
  if (row) {
    return {
      id: row.id,
      ownerUserId: row.ownerUserId,
      name: row.name,
      heatmapSampleRate: row.heatmapSampleRate,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    }
  }

  return getOrCreateOwnerWorkspace(actorUserId)
}
