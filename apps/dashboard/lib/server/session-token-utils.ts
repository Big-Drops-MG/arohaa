export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60

export function sessionExpiresAtFromNow(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000) + SESSION_MAX_AGE_SECONDS
}

export function isSessionExpired(
  sessionExpiresAt: number | null | undefined,
  nowMs = Date.now()
): boolean {
  if (
    typeof sessionExpiresAt !== "number" ||
    !Number.isFinite(sessionExpiresAt)
  ) {
    return true
  }
  return nowMs / 1000 >= sessionExpiresAt
}

export function shouldInvalidateJwtSession(
  token: { sessionExpiresAt?: unknown },
  nowMs = Date.now()
): boolean {
  return isSessionExpired(
    typeof token.sessionExpiresAt === "number"
      ? token.sessionExpiresAt
      : undefined,
    nowMs
  )
}

export function isTokenInvalidatedBySessionsInvalidBefore(
  iatSeconds: number,
  sessionsInvalidBefore: Date | null | undefined
): boolean {
  if (!sessionsInvalidBefore) return false
  return iatSeconds * 1000 < sessionsInvalidBefore.getTime()
}
