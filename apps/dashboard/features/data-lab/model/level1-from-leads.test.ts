import { afterEach, describe, expect, it, vi } from "vitest"
import type {
  DataExportDashboardData,
  DataExportLeadRow,
} from "@/features/data-export/model/data-export"
import { fetchDataLabStatsFromLeadsTable } from "./level1-from-leads"

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
    total: 119,
    limit: 50,
    offset,
    hasMore: offset + 50 < 119,
    hasRedirect: true,
    level1Stats: [],
    level1Complete: false,
    level2Stats: [],
    level2Complete: false,
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
