import { describe, expect, it } from "vitest"
import {
  emptyLandingPageMetrics,
  submissionCardMetricLabel,
} from "@/features/dashboard/model/landing-page"
import { buildLandingPageMetrics } from "@/lib/server/landing-page-metrics-load"

describe("buildLandingPageMetrics", () => {
  it("surfaces all-time visitors and form submits on collection cards", () => {
    const metrics = buildLandingPageMetrics(
      {
        activeUsers: 3,
        visitors: 1200,
        formSubmissions: 45,
        bounceRate: 38.2,
      },
      "single"
    )

    expect(metrics).toEqual([
      { label: "Active Now", value: "3" },
      { label: "Visitors", value: "1,200" },
      { label: "Form Submits", value: "45" },
    ])
  })

  it("uses zip submit label for zip form types", () => {
    const metrics = buildLandingPageMetrics(
      {
        activeUsers: 0,
        visitors: 10,
        formSubmissions: 2,
        bounceRate: 0,
      },
      "zip"
    )
    expect(metrics[2]?.label).toBe("Zip Submits")
  })

  it("does not put bounce rate on the card (different period would mix silently)", () => {
    const metrics = buildLandingPageMetrics(
      {
        activeUsers: 1,
        visitors: 1,
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
  it("matches the all-time card slots", () => {
    expect(emptyLandingPageMetrics("single")).toEqual([
      { label: "Active Now", value: "0" },
      { label: "Visitors", value: "0" },
      { label: "Form Submits", value: "0" },
    ])
    expect(submissionCardMetricLabel("none")).toBe("Service Clicks")
    expect(submissionCardMetricLabel("zip")).toBe("Zip Submits")
  })
})
