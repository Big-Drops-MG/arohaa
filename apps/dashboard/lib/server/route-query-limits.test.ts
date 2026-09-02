import { describe, expect, it } from "vitest"
import {
  parseRouteCustomRange,
  parseRouteOffset,
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

  it("sanitizes heatmap page URLs", () => {
    expect(sanitizeHeatmapPageUrl("https://example.com/x?a=1#h")).toBe(
      "https://example.com/x#h"
    )
    expect(sanitizeHeatmapPageUrl("/landing?x=1")).toBe("/landing")
    expect(sanitizeHeatmapPageUrl("javascript:alert(1)")).toBeNull()
  })
})
