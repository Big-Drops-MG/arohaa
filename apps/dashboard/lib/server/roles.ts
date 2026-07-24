import { asc, db, eq, roles } from "@workspace/database"
import {
  isValidRoleName,
  normalizeRoleName,
} from "@/features/auth/model/role-options"

export async function listRoleNames(): Promise<string[]> {
  const rows = await db.query.roles.findMany({
    orderBy: [asc(roles.name)],
    columns: { name: true },
  })
  return rows.map((row) => row.name)
}

/** Insert role if missing; returns normalized name. */
export async function ensureRoleExists(roleName: string): Promise<string> {
  const name = normalizeRoleName(roleName)
  if (!isValidRoleName(name)) {
    throw new Error("Invalid role name")
  }

  const existing = await db.query.roles.findFirst({
    where: eq(roles.name, name),
    columns: { name: true },
  })
  if (existing) return existing.name

  try {
    await db.insert(roles).values({ name })
    return name
  } catch (err) {
    const code =
      (err as { code?: string; cause?: { code?: string } })?.code ??
      (err as { cause?: { code?: string } })?.cause?.code
    if (code === "23505") {
      return name
    }
    throw err
  }
}
