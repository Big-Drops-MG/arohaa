import { describe, expect, it } from "vitest"
import type { DataExportLeadRow } from "@/features/data-export/model/data-export"
import {
  buildDataLabLeadsScanCacheKey,
  leadScanIdentity,
  takeNewerLeadsUntilKnown,
} from "./data-lab-leads-scan"

function lead(
  sessionId: string,
  overrides: Partial<DataExportLeadRow> = {}
): DataExportLeadRow {
  return {
    sessionId,
    macId: "",
    createdAt: "2026-11-12 12:00:00",
    submittedAt: null,
    zip: "",
    clientIp: "",
    email: "",
    utmSource: "",
    utmId: "",
    utmS1: "",
    trustedFormUrl: "",
    formSubmitted: true,
    returnCount: 0,
    fields: {},
    fraud: null,
    behavior: null,
    ...overrides,
  }
}

describe("buildDataLabLeadsScanCacheKey", () => {
  it("changes when filters change", () => {
    const base = buildDataLabLeadsScanCacheKey({
      projectId: "p1",
      rangeId: "7d",
    })
    const withUtm = buildDataLabLeadsScanCacheKey({
      projectId: "p1",
      rangeId: "7d",
      utmFilter: { utm_source: ["559"] },
    })
    const withSegment = buildDataLabLeadsScanCacheKey({
      projectId: "p1",
      rangeId: "7d",
      segmentId: "seg-1",
    })
    expect(base).not.toBe(withUtm)
    expect(base).not.toBe(withSegment)
    expect(withUtm).not.toBe(withSegment)
  })
})

describe("takeNewerLeadsUntilKnown", () => {
  it("keeps only leads newer than the known set", () => {
    const known = new Set([leadScanIdentity(lead("old"))])
    const result = takeNewerLeadsUntilKnown(
      [lead("new-1"), lead("new-2"), lead("old"), lead("older")],
      known
    )
    expect(result.hitKnown).toBe(true)
    expect(result.newer.map((row) => row.sessionId)).toEqual(["new-1", "new-2"])
  })

  it("returns all page leads when none are known", () => {
    const known = new Set([leadScanIdentity(lead("other"))])
    const result = takeNewerLeadsUntilKnown([lead("a"), lead("b")], known)
    expect(result.hitKnown).toBe(false)
    expect(result.newer.map((row) => row.sessionId)).toEqual(["a", "b"])
  })
})
