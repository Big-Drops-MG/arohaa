import { afterEach, describe, expect, it, vi } from "vitest"

describe("resolveAppBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("uses NEXT_PUBLIC_APP_URL when set to a valid host", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://dev.arohaa.net/")
    vi.stubEnv("NEXTAUTH_URL", "")
    vi.stubEnv("AUTH_URL", "")
    vi.stubEnv("VERCEL_URL", "")
    const { resolveAppBaseUrl } = await import("./app-base-url")
    expect(resolveAppBaseUrl()).toBe("https://dev.arohaa.net")
  })

  it("rewrites dead dashboard.arohaa.com to www.arohaa.net", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://dashboard.arohaa.com")
    vi.stubEnv("NEXTAUTH_URL", "")
    vi.stubEnv("AUTH_URL", "")
    vi.stubEnv("VERCEL_URL", "")
    const { resolveAppBaseUrl, PRODUCTION_APP_BASE_URL } =
      await import("./app-base-url")
    expect(resolveAppBaseUrl()).toBe(PRODUCTION_APP_BASE_URL)
  })

  it("falls back to localhost outside production when unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "")
    vi.stubEnv("NEXTAUTH_URL", "")
    vi.stubEnv("AUTH_URL", "")
    vi.stubEnv("VERCEL_URL", "")
    vi.stubEnv("NODE_ENV", "test")
    const { resolveAppBaseUrl } = await import("./app-base-url")
    expect(resolveAppBaseUrl()).toBe("http://localhost:3000")
  })
})
