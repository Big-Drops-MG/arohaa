import { describe, expect, it } from "vitest"
import type { DataExportLeadRow } from "@/features/data-export/model/data-export"
import {
  matchesLeadReviewFilter,
  pasteActivityLabel,
  summarizeLeadReview,
} from "./lead-review"

function lead(
  overrides: Partial<DataExportLeadRow> & {
    fraudLabel?: "fraud" | "legit"
    coverage?: "sufficient" | "insufficient"
    pasteCount?: number
  } = {}
): DataExportLeadRow {
  const {
    fraudLabel = "legit",
    coverage = "sufficient",
    pasteCount = 0,
    ...rest
  } = overrides
  return {
    sessionId: "s1",
    macId: "m1",
    createdAt: "2026-11-12 12:00:00",
    submittedAt: null,
    zip: "10001",
    clientIp: "1.1.1.1",
    email: "a@b.com",
    utmSource: "559",
    utmId: "",
    trustedFormUrl: "",
    formSubmitted: true,
    returnCount: 0,
    fields: {},
    fraud: {
      score: fraudLabel === "fraud" ? 20 : 80,
      scoreAvailable: true,
      label: fraudLabel,
      effectiveLabel: fraudLabel,
      coverage,
      findings: [],
      reasons: [],
      modelVersion: "test",
    },
    behavior:
      pasteCount > 0
        ? {
            reason: "paste",
            observedAt: "2026-11-12T12:00:00Z",
            visibleMs: 0,
            activeMs: 0,
            focusCount: 0,
            inputCount: 0,
            changeCount: 0,
            pasteCount,
            autofillHints: 0,
            pointerCount: 0,
            touchCount: 0,
            keyboardCount: 0,
            trustedEventCount: 0,
            untrustedEventCount: 0,
            formStartAt: null,
            formSubmitAt: null,
            sdkInitMs: null,
          }
        : null,
    ...rest,
  }
}

describe("lead-review filters", () => {
  it("summarizes elevated, incomplete, and paste counts", () => {
    const rows = [
      lead({ fraudLabel: "fraud" }),
      lead({ coverage: "insufficient", fraudLabel: "legit" }),
      lead({ pasteCount: 2 }),
    ]
    expect(summarizeLeadReview(rows)).toEqual({
      submissions: 3,
      elevated: 1,
      incomplete: 1,
      paste: 1,
    })
  })

  it("matches paste and elevated filters", () => {
    const pasted = lead({ pasteCount: 1 })
    const elevated = lead({ fraudLabel: "fraud" })
    expect(matchesLeadReviewFilter(pasted, "paste")).toBe(true)
    expect(matchesLeadReviewFilter(elevated, "elevated")).toBe(true)
    expect(matchesLeadReviewFilter(pasted, "elevated")).toBe(false)
    expect(pasteActivityLabel(pasted)).toBe("Paste (Ctrl+V)")
    expect(pasteActivityLabel(lead({ pasteCount: 3 }))).toBe("Paste ×3")
  })
})
