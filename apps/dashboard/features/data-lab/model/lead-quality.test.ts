import { describe, expect, it } from "vitest"
import type { DataExportLeadRow } from "@/features/data-export/model/data-export"
import {
  computeLeadQualityByUtmSource,
  formatLeadQualityPercent,
  leadMatchesQualityAttribute,
} from "@/features/data-lab/model/lead-quality"

function lead(
  utmSource: string,
  fields: Record<string, string>
): DataExportLeadRow {
  return {
    sessionId: `${utmSource}-${JSON.stringify(fields)}`,
    macId: "",
    createdAt: "2026-01-01T00:00:00Z",
    submittedAt: null,
    zip: "90210",
    clientIp: "",
    email: "",
    utmSource,
    utmId: "",
    trustedFormUrl: "",
    formSubmitted: true,
    returnCount: 0,
    fields,
    fraud: null,
    behavior: null,
  }
}

describe("lead quality attribute matching", () => {
  it("matches homeowner / insured / military / married truthy values", () => {
    const row = lead("fb", {
      driver_0_homeowner: "Own",
      currently_insured: "Insured",
      driver_0_military: "Veteran",
      driver_0_married: "Married",
    })
    expect(leadMatchesQualityAttribute(row, "homeowner")).toBe(true)
    expect(leadMatchesQualityAttribute(row, "currentlyInsured")).toBe(true)
    expect(leadMatchesQualityAttribute(row, "military")).toBe(true)
    expect(leadMatchesQualityAttribute(row, "married")).toBe(true)
  })

  it("rejects rent / uninsured / single / civilian", () => {
    const row = lead("fb", {
      driver_0_homeowner: "Rent",
      currently_insured: "Not Insured",
      driver_0_military: "Civilian",
      marital_status: "Single",
    })
    expect(leadMatchesQualityAttribute(row, "homeowner")).toBe(false)
    expect(leadMatchesQualityAttribute(row, "currentlyInsured")).toBe(false)
    expect(leadMatchesQualityAttribute(row, "military")).toBe(false)
    expect(leadMatchesQualityAttribute(row, "married")).toBe(false)
  })

  it("matches good-excellent credit and 2+ vehicles", () => {
    const credit = lead("tiktok", { driver_0_credit: "Good / Excellent" })
    expect(leadMatchesQualityAttribute(credit, "goodCredit")).toBe(true)

    const multi = lead("tiktok", { car_1_make: "TOY" })
    expect(leadMatchesQualityAttribute(multi, "multiVehicle")).toBe(true)

    const byCount = lead("tiktok", { num_vehicles: "2" })
    expect(leadMatchesQualityAttribute(byCount, "multiVehicle")).toBe(true)
  })
})

describe("computeLeadQualityByUtmSource", () => {
  it("aggregates percentages by utm source", () => {
    const rows = computeLeadQualityByUtmSource([
      lead("fb", { homeowner: "yes", currently_insured: "yes" }),
      lead("fb", { homeowner: "no", currently_insured: "yes" }),
      lead("google", { homeowner: "yes" }),
      lead("", { homeowner: "yes" }),
    ])

    expect(rows).toHaveLength(3)
    const fb = rows.find((row) => row.utmSource === "fb")
    expect(fb?.totalLeads).toBe(2)
    expect(formatLeadQualityPercent(fb?.rates.homeowner ?? 0)).toBe("50%")
    expect(formatLeadQualityPercent(fb?.rates.currentlyInsured ?? 0)).toBe(
      "100%"
    )

    const none = rows.find((row) => row.utmSource === "(none)")
    expect(none?.totalLeads).toBe(1)
    expect(formatLeadQualityPercent(none?.rates.homeowner ?? 0)).toBe("100%")
  })
})
