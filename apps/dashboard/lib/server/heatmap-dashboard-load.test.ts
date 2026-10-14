import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const requireLandingPageActor = vi.hoisted(() => vi.fn())
const getActiveLandingPageForActor = vi.hoisted(() => vi.fn())
const resolveUtmFilterForActor = vi.hoisted(() => vi.fn())
const resolveIngestApiBase = vi.hoisted(() => vi.fn())
const resolveInternalApiSecret = vi.hoisted(() => vi.fn())

vi.mock("@/lib/server/landing-auth", () => ({
  requireLandingPageActor,
}))

vi.mock("@/lib/server/landing-pages-store", () => ({
  getActiveLandingPageForActor,
}))

vi.mock("@/lib/server/analytics-utm-params", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/server/analytics-utm-params")
  >("@/lib/server/analytics-utm-params")
  return {
    ...actual,
    resolveUtmFilterForActor,
  }
})

vi.mock("@/lib/server/analytics-env", () => ({
  resolveIngestApiBase,
  resolveInternalApiSecret,
}))

describe("heatmap analytics failure handling", () => {
  beforeEach(() => {
    requireLandingPageActor.mockResolvedValue({
      id: "user-1",
      roleId: "role-member",
    })
    resolveUtmFilterForActor.mockResolvedValue(undefined)
    getActiveLandingPageForActor.mockResolvedValue({
      id: "lp-row-1",
      publicId: "lp_test",
      landingPageUrl: "https://example.com/lp",
      formType: "single",
      workspaceId: "ws-company",
    })
    resolveIngestApiBase.mockReturnValue("https://api.example.test")
    resolveInternalApiSecret.mockReturnValue("secret")
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("loadHeatmapDashboardDataForApi returns 503 on analytics failure (not ok empty)", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("boom", { status: 500 }))
    const { loadHeatmapDashboardDataForApi } =
      await import("./heatmap-dashboard-load")
    const result = await loadHeatmapDashboardDataForApi("lp_test", "7d")
    expect(result).toEqual({
      ok: false,
      status: 503,
      error: "Analytics temporarily unavailable",
    })
  })

  it("loadHeatmapDashboardDataForApi returns 503 on timeout", async () => {
    vi.mocked(fetch).mockRejectedValue(
      Object.assign(new Error("Aborted"), { name: "AbortError" })
    )
    const { loadHeatmapDashboardDataForApi } =
      await import("./heatmap-dashboard-load")
    const result = await loadHeatmapDashboardDataForApi("lp_test", "7d")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(503)
  })

  it("loadHeatmapDashboardData marks analyticsUnavailable on failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"))
    const { loadHeatmapDashboardData } =
      await import("./heatmap-dashboard-load")
    const data = await loadHeatmapDashboardData({
      landingPagePublicId: "lp_test",
      rangeId: "7d",
    })
    expect(data.analyticsUnavailable).toBe(true)
    expect(data.totalEvents).toBe(0)
  })

  it("successful empty heatmap is not marked unavailable", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          rangeId: "7d",
          mode: "click",
          device: "desktop",
          pageUrl: "https://example.com/lp",
          pageUrls: ["https://example.com/lp"],
          cells: [],
          points: [],
          scrollBuckets: [],
          sections: [],
          fields: [],
          maxValue: 0,
          totalEvents: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
    const { loadHeatmapDashboardDataForApi } =
      await import("./heatmap-dashboard-load")
    const result = await loadHeatmapDashboardDataForApi("lp_test", "7d")
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.analyticsUnavailable).toBeFalsy()
      expect(result.data.totalEvents).toBe(0)
    }
  })
})

describe("getHeatmapUnavailableDashboardData", () => {
  it("flags empty shell as unavailable", async () => {
    const { getHeatmapUnavailableDashboardData } =
      await import("@/features/heatmap/controller/heatmap-empty-data")
    const data = getHeatmapUnavailableDashboardData("lp_test")
    expect(data.analyticsUnavailable).toBe(true)
    expect(data.totalEvents).toBe(0)
  })
})
