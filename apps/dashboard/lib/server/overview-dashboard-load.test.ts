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

describe("buildUnavailableOverviewForRange", () => {
  it("marks empty overview as analyticsUnavailable so UI shows failure, not zeros", async () => {
    const { buildUnavailableOverviewForRange } =
      await import("./overview-dashboard-load")
    const data = buildUnavailableOverviewForRange("lp_test", "single", "7d")
    expect(data.analyticsUnavailable).toBe(true)
    expect(data.kpisByDateRange["7d"]?.visitors).toBe("0")
  })
})

describe("loadOverviewDashboardData analytics failures", () => {
  beforeEach(() => {
    requireLandingPageActor.mockResolvedValue({
      id: "user-1",
      roleId: "role-member",
    })
    resolveUtmFilterForActor.mockResolvedValue(undefined)
    getActiveLandingPageForActor.mockResolvedValue({
      id: "lp-row-1",
      publicId: "lp_test",
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

  it("sets analyticsUnavailable on non-502/503 HTTP errors (e.g. 500)", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("boom", { status: 500 }))
    const { loadOverviewDashboardData } =
      await import("./overview-dashboard-load")
    const data = await loadOverviewDashboardData("lp_test", "7d")
    expect(data.analyticsUnavailable).toBe(true)
    expect(data.kpisByDateRange["7d"]?.visitors).toBe("0")
  })

  it("sets analyticsUnavailable on 502/503", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("unavailable", { status: 503 })
    )
    const { loadOverviewDashboardData } =
      await import("./overview-dashboard-load")
    const data = await loadOverviewDashboardData("lp_test", "7d")
    expect(data.analyticsUnavailable).toBe(true)
  })

  it("sets analyticsUnavailable on timeout/abort", async () => {
    vi.mocked(fetch).mockRejectedValue(
      Object.assign(new Error("Aborted"), { name: "AbortError" })
    )
    const { loadOverviewDashboardData } =
      await import("./overview-dashboard-load")
    const data = await loadOverviewDashboardData("lp_test", "7d")
    expect(data.analyticsUnavailable).toBe(true)
  })

  it("loadOverviewDashboardDataForApi returns 503 when analytics is unavailable", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"))
    const { loadOverviewDashboardDataForApi } =
      await import("./overview-dashboard-load")
    const result = await loadOverviewDashboardDataForApi("lp_test", "7d")
    expect(result).toEqual({
      ok: false,
      status: 503,
      error: "Analytics temporarily unavailable",
    })
  })

  it("does not set analyticsUnavailable on successful overview payload", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          rangeId: "7d",
          kpis: {
            visitors: 12,
            sessions: 10,
            pageViews: 20,
            formSubmitted: 2,
            fsr: 20,
            bounceRate: 40,
          },
          funnel: [
            { label: "a", count: 12 },
            { label: "b", count: 8 },
            { label: "c", count: 4 },
            { label: "d", count: 2 },
          ],
          uniqueVisitors7d: 12,
          avgEngagedSecPerSession: 30,
          topCity: "Austin",
          bestDayLabel: "Monday",
          hasEvents24h: true,
          activeUsersNow: 1,
          series: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
    const { loadOverviewDashboardData } =
      await import("./overview-dashboard-load")
    const data = await loadOverviewDashboardData("lp_test", "7d")
    expect(data.analyticsUnavailable).toBeFalsy()
    expect(data.kpisByDateRange["7d"]?.visitors).toBe("12")
  })
})
