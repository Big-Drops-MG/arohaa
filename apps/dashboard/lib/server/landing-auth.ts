import type { InferSelectModel } from "drizzle-orm"
import { auth } from "@/auth"
import {
  db,
  normalizeUserEmail,
  users,
  whereUserEmail,
} from "@workspace/database"

async function fetchUser(email: string) {
  return db.query.users.findFirst({
    where: whereUserEmail(normalizeUserEmail(email)),
  })
}

type UserRow = InferSelectModel<typeof users>

/** Dashboard session user with onboarding + 2FA aligned with `app/(dashboard)/layout.tsx`. */
export async function requireLandingPageActor(): Promise<UserRow | null> {
  const session = await auth()
  const email = session?.user?.email
  if (!email || typeof email !== "string") {
    return null
  }

  const user = await fetchUser(email)
  if (!user?.isTwoFactorEnabled) return null

  if (!user.firstName?.trim() || !user.lastName?.trim() || !user.role?.trim()) {
    return null
  }

  return user
}
