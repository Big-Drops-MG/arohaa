import { describe, expect, it } from "vitest"
import {
  MAX_DASHBOARD_CUSTOM_SPAN_DAYS,
  parseDashboardCustomRange,
} from "./traffic-range.js"

describe("dashboard custom range", () => {
  it("rejects spans over 731 days", () => {
    expect(
      parseDashboardCustomRange("2024-01-01", "2026-02-01")
    ).toBeUndefined()
  })

  it("accepts spans within 731 days", () => {
    expect(parseDashboardCustomRange("2025-01-01", "2025-06-01")).toEqual({
      from: "2025-01-01",
      to: "2025-06-01",
    })
    expect(MAX_DASHBOARD_CUSTOM_SPAN_DAYS).toBe(731)
  })
})
