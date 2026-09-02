import { describe, expect, it, vi } from "vitest"
import {
  WORKSPACE_API_KEY_SCOPE_ANALYTICS,
  WORKSPACE_API_KEY_SCOPE_DATA_EXPORT,
} from "@workspace/database/workspace-api-keys/scopes"
import { validateRequestedApiKeyScopes } from "./workspace-api-key-scopes"

vi.mock("@/lib/server/actor-can", () => ({
  actorCan: vi.fn(async (_actor: { id: string }, perm: string) => {
    if (perm === "landing_pages.read") return true
    if (perm === "data_export.read") return false
    return false
  }),
}))

describe("validateRequestedApiKeyScopes", () => {
  it("accepts analytics-only when actor holds landing_pages.read", async () => {
    const result = await validateRequestedApiKeyScopes(
      { id: "u1", roleId: "r1" },
      [WORKSPACE_API_KEY_SCOPE_ANALYTICS]
    )
    expect(result).toEqual({
      ok: true,
      scopes: [WORKSPACE_API_KEY_SCOPE_ANALYTICS],
    })
  })

  it("rejects export scope when actor lacks data_export.read", async () => {
    const result = await validateRequestedApiKeyScopes(
      { id: "u1", roleId: "r1" },
      [WORKSPACE_API_KEY_SCOPE_DATA_EXPORT]
    )
    expect(result).toEqual({ error: "Cannot grant scopes you do not hold" })
  })

  it("rejects unknown scopes", async () => {
    const result = await validateRequestedApiKeyScopes(
      { id: "u1", roleId: "r1" },
      ["admin.all"]
    )
    expect(result).toEqual({ error: "Invalid scope: admin.all" })
  })
})
