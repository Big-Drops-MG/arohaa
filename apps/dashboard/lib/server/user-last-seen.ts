import { eq } from "drizzle-orm"
import { db, users } from "@workspace/database"

/** Consider a user Active if last seen within this window. */
export const USER_ACTIVE_WITHIN_MS = 15 * 60 * 1000

/** Skip DB writes if lastSeenAt was updated more recently than this. */
const TOUCH_THROTTLE_MS = 2 * 60 * 1000

export async function touchUserLastSeen(userId: string): Promise<void> {
  if (!userId.trim()) return

  const now = new Date()
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, lastSeenAt: true },
  })
  if (!row) return

  const last = row.lastSeenAt?.getTime() ?? 0
  if (last > 0 && now.getTime() - last < TOUCH_THROTTLE_MS) return

  await db.update(users).set({ lastSeenAt: now }).where(eq(users.id, userId))
}

export function isUserActive(
  lastSeenAt: Date | string | null | undefined,
  now = new Date()
): boolean {
  if (!lastSeenAt) return false
  const ms =
    lastSeenAt instanceof Date
      ? lastSeenAt.getTime()
      : new Date(lastSeenAt).getTime()
  if (!Number.isFinite(ms)) return false
  return now.getTime() - ms <= USER_ACTIVE_WITHIN_MS
}
