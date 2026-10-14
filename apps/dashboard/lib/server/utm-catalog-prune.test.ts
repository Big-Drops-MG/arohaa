import { describe, expect, it } from "vitest"
import { staleActiveUtmParamIds } from "@/lib/server/utm-catalog-prune"

describe("staleActiveUtmParamIds", () => {
  it("marks active values missing from discovery as stale", () => {
    const ids = staleActiveUtmParamIds(
      [
        {
          id: "keep-active",
          key: "utm_s1",
          value: "fresh",
          status: "active",
        },
        {
          id: "stale-active",
          key: "utm_s1",
          value: "old",
          status: "active",
        },
      ],
      [{ key: "utm_s1", value: "fresh" }]
    )
    expect(ids).toEqual(["stale-active"])
  })

  it("never prunes blocked values even when absent from discovery", () => {
    const ids = staleActiveUtmParamIds(
      [
        {
          id: "blocked-legacy",
          key: "utm_s1",
          value: "spam",
          status: "blocked",
        },
        {
          id: "stale-active",
          key: "utm_source",
          value: "gone",
          status: "active",
        },
      ],
      []
    )
    expect(ids).toEqual(["stale-active"])
  })

  it("returns empty when discovery covers all actives", () => {
    const ids = staleActiveUtmParamIds(
      [
        {
          id: "a",
          key: "utm_source",
          value: "google",
          status: "active",
        },
      ],
      [{ key: "utm_source", value: "google" }]
    )
    expect(ids).toEqual([])
  })
})
