import { describe, expect, it } from "vitest"
import { evaluateRouteGuard } from "@/lib/server/route-guard"

describe("route guard rate-limit headers", () => {
  it("includes Retry-After on 429 responses", async () => {
    const result = await evaluateRouteGuard(
      {
        permission: "landing_pages.read",
        actor: "read",
        tab: "overview",
        rateLimit: "landing",
      },
      new Request("https://example.com/api"),
      { publicId: "lp_test" },
      {
        actor: {
          id: "user-1",
          roleId: "role-1",
          teamKind: "internal",
        },
        permissions: "superadmin",
        access: { isExternal: false },
        rateLimited: true,
      }
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(429)
    expect(result.headers?.["Retry-After"]).toBe("60")
  })
})
