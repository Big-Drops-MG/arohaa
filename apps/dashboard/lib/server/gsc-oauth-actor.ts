import { timingSafeEqual } from "node:crypto"

/**
 * Bind the OAuth callback to the user who started connect.
 * Signed state alone is not enough — the browser session must match.
 */
export function gscOAuthActorMatchesState(
  actorId: string,
  stateUserId: string
): boolean {
  const a = Buffer.from(actorId)
  const b = Buffer.from(stateUserId)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
