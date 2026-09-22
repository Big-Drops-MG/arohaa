import { describe, expect, it } from "vitest"
import { isLandingPageLive } from "./landing-page-live"

describe("isLandingPageLive", () => {
  it("treats only verified as live", () => {
    expect(isLandingPageLive("verified")).toBe(true)
    expect(isLandingPageLive("pending_verification")).toBe(false)
    expect(isLandingPageLive("inactive")).toBe(false)
    expect(isLandingPageLive("archived")).toBe(false)
  })
})
