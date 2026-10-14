import { describe, expect, it } from "vitest"
import {
  emptyLandingPageMetrics,
  submissionCardMetricLabel,
} from "@/features/dashboard/model/landing-page"
import { buildLandingPageMetrics } from "@/lib/server/landing-page-metrics-load"

describe("buildLandingPageMetrics", () => {
  it("surfaces visitors7d instead of dropping it for unlabeled bounce/form mix", () => {
    const metrics = buildLandingPageMetrics(
      {
        activeUsers: 3,
        visitors7d: 1200,
        formSubmissions: 45,
        bounceRate: 38.2,
      },
      "single"
    )

    expect(metrics).toEqual([
      { label: "Active Now", value: "3" },
      { label: "Visitors 7d", value: "1,200" },
      { label: "Submits 7d", value: "45" },
    ])
  })

  it("uses zip-period label for zip form types", () => {
    const metrics = buildLandingPageMetrics(
      {
        activeUsers: 0,
        visitors7d: 10,
        formSubmissions: 2,
        bounceRate: 0,
      },
      "zip"
    )
    expect(metrics[2]?.label).toBe("Zip 7d")
  })

  it("does not put bounce rate on the card (different period would mix silently)", () => {
    const metrics = buildLandingPageMetrics(
      {
        activeUsers: 1,
        visitors7d: 1,
        formSubmissions: 1,
        bounceRate: 99.9,
      },
      "single"
    )
    expect(metrics.some((m) => m.label.toLowerCase().includes("bounce"))).toBe(
      false
    )
  })
})

describe("emptyLandingPageMetrics", () => {
  it("matches the period-aware card slots", () => {
    expect(emptyLandingPageMetrics("single")).toEqual([
      { label: "Active Now", value: "0" },
      { label: "Visitors 7d", value: "0" },
      { label: "Submits 7d", value: "0" },
    ])
    expect(submissionCardMetricLabel("none")).toBe("Clicks 7d")
  })
})
