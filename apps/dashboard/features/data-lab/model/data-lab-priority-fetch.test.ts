import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchDataLabWithPriority } from "./data-lab-priority-fetch"
import type { DataExportDashboardData } from "@/features/data-export/model/data-export"

function payload(brandName: string): DataExportDashboardData {
  return {
    brandName,
    dateRangeOptions: [],
    defaultDateRangeId: "7d",
    leads: [],
    total: 0,
    limit: 15,
    offset: 0,
    hasMore: false,
    hasRedirect: true,
    level1Stats: [],
    level1Complete: true,
    level2Stats: [],
    level2Complete: true,
  }
}

function response(data: DataExportDashboardData, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(data),
  } as unknown as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("fetchDataLabWithPriority", () => {
  it("reuses a recent range result", async () => {
    vi.stubGlobal("window", globalThis)
    const fetchMock = vi.fn().mockResolvedValue(response(payload("Acme")))
    vi.stubGlobal("fetch", fetchMock)

    const first = await fetchDataLabWithPriority(
      "/data-lab?range=cache-test",
      new AbortController().signal
    )
    const second = await fetchDataLabWithPriority(
      "/data-lab?range=cache-test",
      new AbortController().signal
    )

    expect(first.brandName).toBe("Acme")
    expect(second).toBe(first)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ priority: "high" })
  })

  it("retries a transient server failure", async () => {
    vi.stubGlobal("window", globalThis)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(payload("retry"), 503))
      .mockResolvedValueOnce(response(payload("Recovered")))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchDataLabWithPriority(
      "/data-lab?range=retry-test",
      new AbortController().signal
    )

    expect(result.brandName).toBe("Recovered")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
