import { describe, expect, it } from "vitest"
import { gscOAuthActorMatchesState } from "@/lib/server/gsc-oauth-actor"

describe("gscOAuthActorMatchesState", () => {
  it("accepts the same user id that signed the OAuth state", () => {
    expect(gscOAuthActorMatchesState("user-a", "user-a")).toBe(true)
  })

  it("rejects a different signed-in user (token cannot be stored for another account)", () => {
    expect(gscOAuthActorMatchesState("attacker", "user-a")).toBe(false)
  })

  it("rejects mismatched lengths without throwing", () => {
    expect(gscOAuthActorMatchesState("short", "much-longer-id")).toBe(false)
  })
})
