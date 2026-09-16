import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const redirectHost = vi.hoisted(() => ({ value: "" as string | null }))

vi.mock("../core/sdk-config", () => ({
  getRemoteRedirectHostname: () => redirectHost.value,
}))

vi.mock("../utils/fingerprint", () => ({
  generateFingerprint: () => "fp-test",
}))

function setPath(pathAndQuery: string): void {
  window.history.replaceState({}, "", pathAndQuery)
}

describe("initIdentity query seeding (SR24)", () => {
  beforeEach(() => {
    localStorage.clear()
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0]?.trim()
      if (name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
      }
    })
    redirectHost.value = null
    setPath("/")
  })

  afterEach(() => {
    vi.resetModules()
  })

  it("does not seed aro_uid/aro_sid on a non-redirect host (hijack blocked)", async () => {
    redirectHost.value = "auto-quote.example.com"
    const uid = "11111111-1111-4111-8111-111111111111"
    const sid = "22222222-2222-4222-8222-222222222222"
    setPath(`/?aro_uid=${uid}&aro_sid=${sid}`)

    const { initIdentity, __resetIdentityForTests } = await import(
      "./identity"
    )
    __resetIdentityForTests()
    const id = initIdentity()

    expect(id.uid).not.toBe(uid)
    expect(localStorage.getItem("aro_uid")).not.toBe(uid)
    expect(window.location.search).not.toContain("aro_uid")
  })

  it("seeds only on the configured redirect host with valid UUIDs, then strips params", async () => {
    redirectHost.value = window.location.hostname
    const uid = "11111111-1111-4111-8111-111111111111"
    const sid = "22222222-2222-4222-8222-222222222222"
    setPath(`/?aro_uid=${uid}&aro_sid=${sid}&keep=1`)

    const { initIdentity, __resetIdentityForTests } = await import(
      "./identity"
    )
    __resetIdentityForTests()
    const id = initIdentity()

    expect(id.uid).toBe(uid)
    expect(id.sid).toBe(sid)
    expect(localStorage.getItem("aro_uid")).toBe(uid)
    expect(window.location.search).toBe("?keep=1")
    expect(window.location.search).not.toContain("aro_uid")
  })

  it("rejects non-UUID query identity values", async () => {
    redirectHost.value = window.location.hostname
    setPath("/?aro_uid=short&aro_sid=also-short-but-not-uuid")

    const { initIdentity, __resetIdentityForTests } = await import(
      "./identity"
    )
    __resetIdentityForTests()
    const id = initIdentity()

    expect(id.uid).not.toBe("short")
    expect(window.location.search).not.toContain("aro_uid")
  })
})
