import { describe, expect, it } from "vitest"
import {
  getGlobalSessionsInvalidBefore,
  isSessionExpired,
  isTokenInvalidatedBySessionsInvalidBefore,
  sessionExpiresAtFromNow,
  SESSION_MAX_AGE_SECONDS,
  SESSION_SCHEMA_VERSION,
  shouldInvalidateJwtSession,
} from "./session-token-utils.js"

describe("session token utils", () => {
  it("invalidates tokens issued before sessionsInvalidBefore", () => {
    const invalidBefore = new Date("2026-01-01T12:00:00.000Z")
    const oldIat = Math.floor(
      new Date("2025-12-01T12:00:00.000Z").getTime() / 1000
    )
    const newIat = Math.floor(
      new Date("2026-02-01T12:00:00.000Z").getTime() / 1000
    )

    expect(
      isTokenInvalidatedBySessionsInvalidBefore(oldIat, invalidBefore)
    ).toBe(true)
    expect(
      isTokenInvalidatedBySessionsInvalidBefore(newIat, invalidBefore)
    ).toBe(false)
  })

  it("uses an 8-hour session max age (fixed JWT exp, no rolling refresh)", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(8 * 60 * 60)
  })

  it("rejects sessions past absolute sessionExpiresAt", () => {
    const nowMs = 1_700_000_000_000
    const expiresAt = sessionExpiresAtFromNow(nowMs)
    expect(isSessionExpired(expiresAt, nowMs)).toBe(false)
    expect(
      isSessionExpired(expiresAt, nowMs + SESSION_MAX_AGE_SECONDS * 1000)
    ).toBe(true)
  })

  it("force-logs-out tokens missing schema version or jti", () => {
    const nowMs = 1_700_000_000_000
    const valid = {
      sessionExpiresAt: sessionExpiresAtFromNow(nowMs),
      sessionSchemaVersion: SESSION_SCHEMA_VERSION,
      jti: "abc",
    }
    expect(shouldInvalidateJwtSession(valid, nowMs)).toBe(false)
    expect(
      shouldInvalidateJwtSession(
        { ...valid, sessionSchemaVersion: undefined },
        nowMs
      )
    ).toBe(true)
    expect(shouldInvalidateJwtSession({ ...valid, jti: "" }, nowMs)).toBe(true)
  })

  it("parses AUTH_SESSIONS_INVALID_BEFORE kill-switch", () => {
    const prev = process.env.AUTH_SESSIONS_INVALID_BEFORE
    try {
      process.env.AUTH_SESSIONS_INVALID_BEFORE = "2026-03-01T00:00:00.000Z"
      expect(getGlobalSessionsInvalidBefore()?.toISOString()).toBe(
        "2026-03-01T00:00:00.000Z"
      )
      process.env.AUTH_SESSIONS_INVALID_BEFORE = "not-a-date"
      expect(getGlobalSessionsInvalidBefore()).toBeNull()
    } finally {
      if (prev === undefined) delete process.env.AUTH_SESSIONS_INVALID_BEFORE
      else process.env.AUTH_SESSIONS_INVALID_BEFORE = prev
    }
  })
})
