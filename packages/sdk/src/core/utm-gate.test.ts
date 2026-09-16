import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  UTM_BLOCK_FETCH_TIMEOUT_MS,
  enforceUtmBlockGate,
} from "./utm-gate"

vi.mock("../utils/url", () => ({
  getAttributionData: () => ({
    utm_source: "test_source",
    utm_medium: "",
    utm_campaign: "",
    utm_term: "",
    utm_content: "",
    utm_id: "",
    utm_s1: "",
    referrer: "",
  }),
}))

describe("enforceUtmBlockGate (SR22)", () => {
  beforeEach(() => {
    document.documentElement.style.visibility = ""
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("restores page visibility when /v1/utm-blocked hangs until abort", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          const signal = init?.signal
          if (!signal) return
          if (signal.aborted) {
            reject(new DOMException("Aborted", "AbortError"))
            return
          }
          signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"))
          })
        })
      }),
    )

    const pending = enforceUtmBlockGate({
      wid: "00000000-0000-0000-0000-000000000001",
      apiBase: "https://api.example.test",
      lpId: "lp_test",
      formtype: "zip",
    } as never)

    expect(document.documentElement.style.visibility).toBe("hidden")

    await vi.advanceTimersByTimeAsync(UTM_BLOCK_FETCH_TIMEOUT_MS + 50)
    const blocked = await pending

    expect(blocked).toBe(false)
    expect(document.documentElement.style.visibility).not.toBe("hidden")
    expect(UTM_BLOCK_FETCH_TIMEOUT_MS).toBe(2_500)
  })

  it("restores visibility on network error (fail-open)", async () => {
    vi.useRealTimers()
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network"))),
    )

    const blocked = await enforceUtmBlockGate({
      wid: "00000000-0000-0000-0000-000000000001",
      apiBase: "https://api.example.test",
      lpId: "lp_test",
      formtype: "zip",
    } as never)

    expect(blocked).toBe(false)
    expect(document.documentElement.style.visibility).not.toBe("hidden")
  })
})
