import { describe, expect, it } from "vitest"
import { normalizeGooglePhotoUrl } from "@/lib/server/google-profile-image"

describe("normalizeGooglePhotoUrl", () => {
  it("adds a stable size suffix for googleusercontent hosts", () => {
    expect(
      normalizeGooglePhotoUrl(
        "https://lh3.googleusercontent.com/a/ACg8ocExamplePhoto"
      )
    ).toBe("https://lh3.googleusercontent.com/a/ACg8ocExamplePhoto=s128-c")
  })

  it("replaces an existing size suffix", () => {
    expect(
      normalizeGooglePhotoUrl(
        "https://lh3.googleusercontent.com/a/ACg8ocExamplePhoto=s96-c"
      )
    ).toBe("https://lh3.googleusercontent.com/a/ACg8ocExamplePhoto=s128-c")
  })

  it("leaves non-Google URLs unchanged", () => {
    expect(
      normalizeGooglePhotoUrl("https://cdn.example.com/avatar.png?x=1")
    ).toBe("https://cdn.example.com/avatar.png?x=1")
  })
})
