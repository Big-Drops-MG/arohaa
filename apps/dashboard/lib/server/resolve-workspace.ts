import { and, eq, isNull } from "drizzle-orm"
import { db, workspaces } from "@workspace/database"

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
