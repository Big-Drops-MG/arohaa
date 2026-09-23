import { describe, expect, it } from "vitest"
import {
  parseRouteCustomRange,
  parseRouteOffset,
  resolveHeatmapPageUrl,
  sanitizeHeatmapPageUrl,
} from "./route-query-limits.js"

describe("route query limits", () => {
  it("rejects custom ranges over the cap via parseRouteCustomRange", () => {
    expect(parseRouteCustomRange("2024-01-01", "2026-02-01")).toBeUndefined()
  })

  it("caps offset", () => {
    expect(parseRouteOffset("99999", 10_000)).toBe(10_000)
    expect(parseRouteOffset("12", 10_000)).toBe(12)
  })

  it("sanitizes heatmap page URLs: keeps origin+hash, strips query", () => {
    expect(sanitizeHeatmapPageUrl("https://example.com/x?a=1#/zip")).toBe(
      "https://example.com/x#/zip"
    )
    expect(sanitizeHeatmapPageUrl("/landing?x=1#frag")).toBe("/landing#frag")
    expect(sanitizeHeatmapPageUrl("javascript:alert(1)")).toBeNull()
    expect(sanitizeHeatmapPageUrl("https://autoinsurance.quotifii.com/")).toBe(
      "https://autoinsurance.quotifii.com/"
    )
  })

  it("resolves heatmap page to an absolute landing URL for previews", () => {
    expect(
      resolveHeatmapPageUrl(
        "https://example.com/terms?x=1",
        "https://example.com/"
      )
    ).toBe("https://example.com/terms")
    expect(
      resolveHeatmapPageUrl(null, "https://autoinsurance.quotifii.com/")
    ).toBe("https://autoinsurance.quotifii.com/")
    expect(
      resolveHeatmapPageUrl(
        "/offer#/zip",
        "https://autoinsurance.quotifii.com/"
      )
    ).toBe("https://autoinsurance.quotifii.com/offer#/zip")
    expect(resolveHeatmapPageUrl("javascript:alert(1)", "")).toBeNull()
  })
})
