import "server-only"

import type { Session } from "next-auth"

export function sessionHasVerifiedTwoFactor(
  session: Session | null | undefined
): boolean {
  if (!session) return false
  const at = session.twoFactorAt
  return typeof at === "number" && Number.isFinite(at) && at > 0
}

export function sessionNeedsTwoFactorChallenge(
  session: Session | null | undefined
): boolean {
  if (!session?.user) return false
  const enabled =
    (session.user as { isTwoFactorEnabled?: boolean }).isTwoFactorEnabled ===
    true
  if (!enabled) return false
  return !sessionHasVerifiedTwoFactor(session)
}
