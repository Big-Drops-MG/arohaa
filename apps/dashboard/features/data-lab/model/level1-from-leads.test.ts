import { afterEach, describe, expect, it, vi } from "vitest"
import type {
  DataExportDashboardData,
  DataExportLeadRow,
} from "@/features/data-export/model/data-export"
import {
  dataLabStatsFromExportPayload,
  fetchDataLabStatsFromLeadsTable,
} from "./level1-from-leads"
import { hasCompleteLevel3Stats, resolveLevel3Stats } from "./level3"

function lead(sessionId: string): DataExportLeadRow {
  return {
    sessionId,
    macId: "",
    createdAt: "2026-09-01T12:00:00.000Z",
    submittedAt: "2026-09-01T12:00:01.000Z",
    zip: "10001",
    email: "",
    utmSource: "",
    utmId: "",
    trustedFormUrl: "",
    formSubmitted: true,
    fields: { city: "New York", state: "NY" },
  }
}

function page(offset: number): DataExportDashboardData {
  return {
    brandName: "Acme",
    dateRangeOptions: [],
    defaultDateRangeId: "7d",
    leads: [lead(`session-${offset}`)],
    visibleLeadFieldKeys: ["city", "state"],
    total: 119,
    limit: 50,
    offset,
    hasMore: offset + 50 < 119,
    hasRedirect: true,
    level1Stats: [],
    level1Complete: false,
    level2Stats: [],
    level2Complete: false,
    level3: { section: "level3", winners: [], boards: [], actions: [] },
    level3Complete: true,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("fetchDataLabStatsFromLeadsTable", () => {
  it("fetches known remaining pages concurrently from the seed total", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      const offset = Number(
        new URL(url, "http://local").searchParams.get("offset")
      )
      return {
        ok: true,
        json: async () => page(offset),
      } as Response
    })
    vi.stubGlobal("fetch", fetchMock)

    await fetchDataLabStatsFromLeadsTable({
      projectId: "lp_test",
      dateRangeId: "7d",
      seed: {
        ...page(0),
        leads: Array.from({ length: 15 }, (_, index) => lead(`seed-${index}`)),
        limit: 15,
        offset: 0,
        hasMore: true,
      },
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(
      fetchMock.mock.calls.map(([url]) =>
        Number(new URL(url, "http://local").searchParams.get("offset"))
      )
    ).toEqual([15, 65, 115])
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ priority: "high" })
  })
})

describe("dataLabStatsFromExportPayload", () => {
  it("computes Level 3 from leads when the payload does not include it", () => {
    const stats = dataLabStatsFromExportPayload({
      ...page(0),
      level3: null,
    })

    expect(stats.level3.section).toBe("level3")
    expect(stats.level3.winners.map((winner) => winner.id)).toContain(
      "best-converting-source"
    )
    expect(stats.level3.boards.map((board) => board.id)).toContain(
      "source-performance"
    )
  })

  it("computes Level 3 from leads when the payload has empty level3 arrays", () => {
    const stats = dataLabStatsFromExportPayload({
      ...page(0),
      level3: { section: "level3", winners: [], boards: [], actions: [] },
      level3Complete: true,
    })

    expect(stats.level3.section).toBe("level3")
    expect(stats.level3.winners.length).toBeGreaterThan(0)
    expect(stats.level3.boards.length).toBeGreaterThan(0)
  })
})

describe("hasCompleteLevel3Stats", () => {
  it("returns false for null, undefined, or empty payload", () => {
    expect(hasCompleteLevel3Stats(null)).toBe(false)
    expect(hasCompleteLevel3Stats(undefined)).toBe(false)
    expect(
      hasCompleteLevel3Stats({
        section: "level3",
        winners: [],
        boards: [],
        actions: [],
      })
    ).toBe(false)
  })

  it("returns true when winners and boards are populated", () => {
    expect(
      hasCompleteLevel3Stats({
        section: "level3",
        winners: [
          {
            id: "best-converting-source",
            label: "Best Converting Source",
            value: "google",
            metricLabel: "Submitted leads",
            metricValue: 10,
            sampleSize: 20,
            enoughData: true,
          },
        ],
        boards: [
          {
            id: "source-performance",
            title: "Source Performance",
            columns: [],
            rows: [],
            takeaway: "Google is converting best",
          },
        ],
        actions: [],
      })
    ).toBe(true)
  })
})

describe("resolveLevel3Stats", () => {
  it("resolves from API when completeFromApi is true and payload is complete", () => {
    const apiPayload = {
      section: "level3" as const,
      winners: [
        {
          id: "best-converting-source",
          label: "Best Converting Source",
          value: "facebook",
          metricLabel: "Submitted leads",
          metricValue: 12,
          sampleSize: 25,
          enoughData: true,
        },
      ],
      boards: [
        {
          id: "source-performance",
          title: "Source Performance",
          columns: [],
          rows: [],
          takeaway: "Facebook is converting best",
        },
      ],
      actions: ["Test action"],
    }
    const resolved = resolveLevel3Stats(apiPayload, [], [], true)
    expect(resolved.complete).toBe(true)
    expect(resolved.payload.winners[0]?.value).toBe("facebook")
  })

  it("falls back to leads when API payload is incomplete", () => {
    const leads = [lead("s1"), lead("s2")]
    const resolved = resolveLevel3Stats(
      { section: "level3", winners: [], boards: [], actions: [] },
      leads,
      ["city", "state"],
      false
    )
    expect(resolved.complete).toBe(false)
    expect(resolved.payload.winners.length).toBeGreaterThan(0)
  })
})
