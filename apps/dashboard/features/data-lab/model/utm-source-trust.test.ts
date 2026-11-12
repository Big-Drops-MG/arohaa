import { describe, expect, it } from "vitest"
import type { DataExportLeadRow } from "@/features/data-export/model/data-export"
import {
  computeUtmSourceTrustRows,
  evaluateUtmSourceTrustReputation,
  leadHasLocationMismatch,
} from "./utm-source-trust"

function lead(
  overrides: Partial<DataExportLeadRow> & {
    score?: number | null
    findings?: Array<{ code: string; detail: string }>
  } = {}
): DataExportLeadRow {
  const { score = 70, findings = [], ...rest } = overrides
  return {
    sessionId: "s1",
    macId: "m1",
    createdAt: "2026-11-12 12:00:00",
    submittedAt: "2026-11-12 12:00:00",
    zip: "10001",
    clientIp: "1.1.1.1",
    email: "a@b.com",
    utmSource: "559",
    utmId: "",
    utmS1: "",
    trustedFormUrl: "",
    formSubmitted: true,
    returnCount: 0,
    fields: {},
    fraud: {
      score,
      scoreAvailable: score != null,
      label: "legit",
      effectiveLabel: "legit",
      coverage: "sufficient",
      findings,
      reasons: [],
      modelVersion: "test",
    },
    behavior: null,
    ...rest,
  }
}

describe("utm-source-trust", () => {
  it("detects location mismatch findings", () => {
    expect(
      leadHasLocationMismatch(
        lead({
          findings: [{ code: "location_inconsistency", detail: "ZIP vs IP" }],
        })
      )
    ).toBe(true)
    expect(leadHasLocationMismatch(lead())).toBe(false)
  })

  it("marks cluster reputation at threshold", () => {
    expect(
      evaluateUtmSourceTrustReputation({
        source: "559",
        submitCount: 10,
        locationMismatchCount: 5,
      })
    ).toBe("location_mismatch_cluster")
    expect(
      evaluateUtmSourceTrustReputation({
        source: "559",
        submitCount: 10,
        locationMismatchCount: 4,
      })
    ).toBe("clean")
  })

  it("aggregates trust rows by source label", () => {
    const now = Date.parse("2026-11-12T12:00:00Z")
    const rows = computeUtmSourceTrustRows(
      [
        lead({
          utmSource: "559",
          score: 80,
          submittedAt: "2026-11-12 10:00:00",
        }),
        lead({
          utmSource: "",
          utmId: "abc",
          score: 60,
          submittedAt: "2026-11-12 11:00:00",
          findings: [{ code: "location_inconsistency", detail: "mismatch" }],
        }),
      ],
      now
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]?.utmSource).toBe("559")
    expect(rows[0]?.trustScore).toBe(80)
    expect(rows[1]?.utmSource).toBe("utm_id:abc")
    expect(rows[1]?.mismatchTotal).toBe(1)
  })
})
