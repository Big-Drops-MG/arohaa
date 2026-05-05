import {
  normalizeLandingPageUrl,
  ingestHostnameMatchesLanding,
} from "@workspace/database/landing/normalizeLandingPageUrl"

describe("normalizeLandingPageUrl", () => {
  it("lowercases hostname and strips query and hash", () => {
    const r = normalizeLandingPageUrl(
      "https://WWW.Example.Com/path/?utm=1#frag"
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.hostname).toBe("www.example.com")
    expect(r.normalizedUrl).toBe("https://www.example.com/path")
  })

  it("rejects non-http(s) protocols", () => {
    const r = normalizeLandingPageUrl("javascript:alert(1)")
    expect(r.ok).toBe(false)
  })
})

describe("ingestHostnameMatchesLanding", () => {
  it("matches hostname only (case-insensitive)", () => {
    expect(
      ingestHostnameMatchesLanding(
        "https://WWW.Example.Com/x",
        "www.example.com"
      )
    ).toBe(true)
  })

  it("rejects hostname mismatch", () => {
    expect(
      ingestHostnameMatchesLanding(
        "https://other.example.com/",
        "www.example.com"
      )
    ).toBe(false)
  })
})
