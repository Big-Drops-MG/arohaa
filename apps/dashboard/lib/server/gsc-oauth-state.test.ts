import { afterEach, describe, expect, it, vi } from "vitest"

describe("signGscOAuthState / verifyGscOAuthState", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("round-trips workspace, publicId, and userId", async () => {
    vi.stubEnv("AUTH_SECRET", "test-gsc-oauth-secret")
    const { signGscOAuthState, verifyGscOAuthState } =
      await import("./gsc-oauth-state")
    const state = signGscOAuthState({
      workspaceId: "ws-company",
      publicId: "lp_abc",
      userId: "user-owner",
    })
    expect(verifyGscOAuthState(state)).toEqual({
      workspaceId: "ws-company",
      publicId: "lp_abc",
      userId: "user-owner",
    })
  })

  it("rejects tampered state", async () => {
    vi.stubEnv("AUTH_SECRET", "test-gsc-oauth-secret")
    const { signGscOAuthState, verifyGscOAuthState } =
      await import("./gsc-oauth-state")
    const state = signGscOAuthState({
      workspaceId: "ws-company",
      publicId: "lp_abc",
      userId: "user-owner",
    })
    const [body] = state.split(".")
    expect(verifyGscOAuthState(`${body}.deadbeef`)).toBeNull()
  })
})

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
