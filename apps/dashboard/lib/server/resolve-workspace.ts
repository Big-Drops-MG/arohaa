import { and, eq, inArray, isNull, sql } from "drizzle-orm"
import {
  accessRoles,
  CEO_ROLE_KEY,
  db,
  SUPERADMIN_ROLE_KEY,
  users,
  workspaces,
} from "@workspace/database"

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

async function resolveCompanyOwnerUserId(): Promise<string | null> {
  const candidates = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(accessRoles, eq(accessRoles.id, users.roleId))
    .where(
      and(
        eq(users.accessStatus, "approved"),
        eq(users.teamKind, "internal"),
        inArray(accessRoles.key, [SUPERADMIN_ROLE_KEY, CEO_ROLE_KEY])
      )
    )
    .orderBy(
      sql`CASE WHEN ${accessRoles.key} = ${SUPERADMIN_ROLE_KEY} THEN 0 ELSE 1 END`,
      sql`lower(${users.email})`
    )
    .limit(1)

  return candidates[0]?.id ?? null
}

export async function resolveCompanyWorkspace() {
  const pinnedId = process.env.COMPANY_WORKSPACE_ID?.trim()
  if (pinnedId) {
    const pinned = await db
      .select()
      .from(workspaces)
      .where(and(eq(workspaces.id, pinnedId), isNull(workspaces.deletedAt)))
      .limit(1)
    if (pinned[0]) return pinned[0]
  }

  const ownerUserId = await resolveCompanyOwnerUserId()
  if (!ownerUserId) {
    throw new Error(
      "No approved superadmin/CEO available for company workspace"
    )
  }

  const existing = await db
    .select()
    .from(workspaces)
    .where(
      and(eq(workspaces.ownerUserId, ownerUserId), isNull(workspaces.deletedAt))
    )
    .limit(1)

  if (existing[0]) {
    if (existing[0].name !== "Company") {
      await db
        .update(workspaces)
        .set({ name: "Company", updatedAt: new Date() })
        .where(eq(workspaces.id, existing[0].id))
      return { ...existing[0], name: "Company" }
    }
    return existing[0]
  }

  try {
    await db.insert(workspaces).values({
      ownerUserId,
      name: "Company",
    })
  } catch (err) {
    const code = (err as { code?: string; cause?: { code?: string } })?.code
    const cause = (err as { cause?: { code?: string } })?.cause?.code ?? ""
    const unique = code === "23505" || cause === "23505"
    if (!unique) throw err
  }

  const created = await db
    .select()
    .from(workspaces)
    .where(
      and(eq(workspaces.ownerUserId, ownerUserId), isNull(workspaces.deletedAt))
    )
    .limit(1)

  if (!created[0]) {
    throw new Error("Could not resolve company workspace")
  }
  return created[0]
}

export async function resolveLandingPageWorkspace(_actorUserId?: string) {
  return resolveCompanyWorkspace()
}

export async function resolveTeamSettingsWorkspace(_actorUserId?: string) {
  return resolveCompanyWorkspace()
}
