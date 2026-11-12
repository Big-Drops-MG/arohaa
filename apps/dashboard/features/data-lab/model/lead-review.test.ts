import { describe, expect, it } from "vitest"
import type { DataExportLeadRow } from "@/features/data-export/model/data-export"
import {
  leadHasElevatedRisk,
  leadSourceLabel,
  pasteActivityLabel,
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
    utmSource: "",
    utmId: "",
    utmS1: "",
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

describe("lead-review helpers", () => {
  it("detects elevated risk leads", () => {
    expect(leadHasElevatedRisk(lead({ fraudLabel: "fraud" }))).toBe(true)
    expect(leadHasElevatedRisk(lead({ fraudLabel: "legit" }))).toBe(false)
  })

  it("falls back across utm source fields", () => {
    expect(leadSourceLabel(lead({ utmSource: "559" }))).toBe("559")
    expect(leadSourceLabel(lead({ utmId: "abc" }))).toBe("utm_id:abc")
    expect(leadSourceLabel(lead({ utmS1: "camp1" }))).toBe("s1:camp1")
    expect(leadSourceLabel(lead({ fields: { sid: "from-fields" } }))).toBe(
      "from-fields"
    )
    expect(leadSourceLabel(lead())).toBe("—")
  })

  it("formats paste activity", () => {
    expect(pasteActivityLabel(lead({ pasteCount: 1 }))).toBe("Paste (Ctrl+V)")
    expect(pasteActivityLabel(lead({ pasteCount: 3 }))).toBe("Paste ×3")
  })
})
