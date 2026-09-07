import { describe, expect, it } from "vitest"
import {
  landingPageSlugBase,
  landingPageSlugCandidate,
} from "./landingPageSlug.js"

describe("landing page slugs", () => {
  it("creates a lowercase URL-safe slug", () => {
    expect(landingPageSlugBase("  Café Auto Insurance  ")).toBe(
      "cafe-auto-insurance"
    )
  })

  it("uses a safe fallback for names without Latin slug characters", () => {
    expect(landingPageSlugBase("自動車保険", "lp_gpD0IbRv7QIE2wv5")).toBe(
      "landing-7qie2wv5"
    )
  })

  it("avoids reserved dashboard route names", () => {
    expect(landingPageSlugBase("Team")).toBe("team-landing")
    expect(landingPageSlugBase("New Landing")).toBe("new-landing-landing")
  })

  it("adds deterministic numeric suffixes for duplicate names", () => {
    expect(landingPageSlugCandidate("Acme", 1)).toBe("acme")
    expect(landingPageSlugCandidate("Acme", 2)).toBe("acme-2")
    expect(landingPageSlugCandidate("Acme", 12)).toBe("acme-12")
  })
})
