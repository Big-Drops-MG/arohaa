import type { InferSelectModel } from "drizzle-orm"
import { auth } from "@/auth"

import {
  db,
  normalizeUserEmail,
  users,
  whereUserEmail,
} from "@workspace/database"
import { isApprovedAccess } from "@/lib/server/access-status"
import { sessionNeedsTwoFactorChallenge } from "@/lib/server/session-2fa"

async function fetchUser(email: string) {
  return db.query.users.findFirst({
    where: whereUserEmail(normalizeUserEmail(email)),
  })
}

type UserRow = InferSelectModel<typeof users>

export async function requireLandingPageActor(): Promise<UserRow | null> {
  const session = await auth()
  const email = session?.user?.email
  if (!email || typeof email !== "string") {
    return null
  }

  if (sessionNeedsTwoFactorChallenge(session)) {
    return null
  }

  const user = await fetchUser(email)
  if (!user?.isTwoFactorEnabled) return null

  if (!user.firstName?.trim() || !user.lastName?.trim() || !user.roleId) {
    return null
  }

  if (!isApprovedAccess(user.accessStatus)) {
    return null
  }

  return user
}
