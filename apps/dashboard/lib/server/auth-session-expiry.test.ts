import { describe, expect, it } from "vitest"
import {
  isSessionExpired,
  sessionExpiresAtFromNow,
  shouldInvalidateJwtSession,
  SESSION_MAX_AGE_SECONDS,
} from "./session-token-utils.js"

describe("session absolute expiry (jwt callback contract)", () => {
  it("invalidates tokens once sessionExpiresAt is reached regardless of refresh", () => {
    const signedInAt = 1_700_000_000_000
    const sessionExpiresAt = sessionExpiresAtFromNow(signedInAt)

    const beforeExpiry = signedInAt + SESSION_MAX_AGE_SECONDS * 1000 - 1
    const atExpiry = signedInAt + SESSION_MAX_AGE_SECONDS * 1000

    expect(isSessionExpired(sessionExpiresAt, beforeExpiry)).toBe(false)
    expect(isSessionExpired(sessionExpiresAt, atExpiry)).toBe(true)
  })

  it("shouldInvalidateJwtSession matches jwt callback behavior", () => {
    const signedInAt = 1_700_000_000_000
    const token = { sessionExpiresAt: sessionExpiresAtFromNow(signedInAt) }
    const beforeExpiry = signedInAt + SESSION_MAX_AGE_SECONDS * 1000 - 1
    const atExpiry = signedInAt + SESSION_MAX_AGE_SECONDS * 1000

    expect(shouldInvalidateJwtSession(token, beforeExpiry)).toBe(false)
    expect(shouldInvalidateJwtSession(token, atExpiry)).toBe(true)
    expect(shouldInvalidateJwtSession({}, beforeExpiry)).toBe(true)
  })
})
