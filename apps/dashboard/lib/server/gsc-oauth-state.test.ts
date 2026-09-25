import { afterEach, describe, expect, it, vi } from "vitest"

describe("resolveGscOAuthRedirectUri", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("canonicalizes production apex and www to www callback", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://arohaa.net")
    vi.stubEnv("NEXTAUTH_URL", "")
    vi.stubEnv("AUTH_URL", "")
    vi.stubEnv("VERCEL_URL", "")
    const { resolveGscOAuthRedirectUri } = await import("./gsc-oauth-state")
    expect(resolveGscOAuthRedirectUri()).toBe(
      "https://www.arohaa.net/api/integrations/gsc/callback"
    )
  })

  it("keeps localhost callback for local auth base", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000")
    vi.stubEnv("NEXTAUTH_URL", "")
    vi.stubEnv("AUTH_URL", "")
    vi.stubEnv("VERCEL_URL", "")
    vi.stubEnv("NODE_ENV", "test")
    const { resolveGscOAuthRedirectUri } = await import("./gsc-oauth-state")
    expect(resolveGscOAuthRedirectUri()).toBe(
      "http://localhost:3000/api/integrations/gsc/callback"
    )
  })

  it("rejects non-allowlisted hosts", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://evil.example")
    vi.stubEnv("NEXTAUTH_URL", "")
    vi.stubEnv("AUTH_URL", "")
    vi.stubEnv("VERCEL_URL", "")
    const { resolveGscOAuthRedirectUri } = await import("./gsc-oauth-state")
    expect(() => resolveGscOAuthRedirectUri()).toThrow(/allowlisted/)
  })
})
