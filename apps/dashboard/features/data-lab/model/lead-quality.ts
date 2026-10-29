import type { DataExportLeadRow } from "@/features/data-export/model/data-export"

export const LEAD_QUALITY_ATTRIBUTES = [
  {
    id: "homeowner",
    label: "Homeowner",
  },
  {
    id: "multiVehicle",
    label: "2+ vehicles",
  },
  {
    id: "currentlyInsured",
    label: "Currently insured",
  },
  {
    id: "goodCredit",
    label: "Good-Excellent Credit",
  },
  {
    id: "military",
    label: "Military Affiliation",
  },
  {
    id: "married",
    label: "Married",
  },
] as const

export type LeadQualityAttributeId =
  (typeof LEAD_QUALITY_ATTRIBUTES)[number]["id"]

export type LeadQualityRow = {
  utmSource: string
  totalLeads: number
  rates: Record<LeadQualityAttributeId, number>
}

function fieldMap(lead: DataExportLeadRow): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(lead.fields ?? {})) {
    out[key.trim().toLowerCase()] = String(value ?? "").trim()
  }
  return out
}

function pickField(fields: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = fields[key]
    if (value) return value
  }
  return ""
}

function normalizedValue(raw: string): string {
  return raw.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ")
}

function isTruthyYes(raw: string): boolean {
  const value = normalizedValue(raw)
  return [
    "yes",
    "true",
    "y",
    "1",
    "on",
    "own",
    "owner",
    "homeowner",
    "married",
    "insured",
    "currently insured",
  ].includes(value)
}

function isExplicitNo(raw: string): boolean {
  const value = normalizedValue(raw)
  return [
    "no",
    "false",
    "n",
    "0",
    "off",
    "none",
    "rent",
    "renter",
    "uninsured",
    "not insured",
    "single",
    "divorced",
    "separated",
    "widowed",
    "civilian",
  ].includes(value)
}

function isGoodOrExcellentCredit(raw: string): boolean {
  const value = normalizedValue(raw)
  if (!value || isExplicitNo(value)) return false
  if (value.includes("excellent")) return true
  if (value.includes("good")) return true
  if (value === "ge" || value === "g/e" || value === "g e") return true
  return false
}

function isCurrentlyInsured(raw: string): boolean {
  const value = normalizedValue(raw)
  if (!value || isExplicitNo(value)) return false
  if (isTruthyYes(value)) return true
  return value.includes("insured") && !value.includes("uninsured")
}

function isMilitary(raw: string): boolean {
  const value = normalizedValue(raw)
  if (!value || isExplicitNo(value)) return false
  if (isTruthyYes(value)) return true
  return (
    value.includes("military") ||
    value.includes("veteran") ||
    value.includes("active duty") ||
    value.includes("armed forces")
  )
}

function isMarried(raw: string): boolean {
  const value = normalizedValue(raw)
  if (!value || isExplicitNo(value)) return false
  if (isTruthyYes(value)) return true
  return value.includes("married")
}

function isHomeowner(raw: string): boolean {
  const value = normalizedValue(raw)
  if (!value || isExplicitNo(value)) return false
  if (isTruthyYes(value)) return true
  return value.includes("own") || value.includes("homeowner")
}

function hasSecondVehicle(fields: Record<string, string>): boolean {
  if (isTruthyYes(pickField(fields, ["second_vehicle", "secondvehicle"]))) {
    return true
  }

  const countRaw = pickField(fields, [
    "vehicle_count",
    "num_vehicles",
    "number_of_vehicles",
    "num_cars",
    "cars",
    "vehicles",
  ])
  const count = Number(countRaw.replace(/[^\d.]/g, ""))
  if (Number.isFinite(count) && count >= 2) return true

  if (
    pickField(fields, [
      "car_1_year",
      "car_1_make",
      "vehicle_1_year",
      "vehicle_1_make",
    ])
  ) {
    return true
  }

  let carSlots = 0
  for (const key of Object.keys(fields)) {
    if (/^(?:car|vehicle)_(\d+)_(?:year|make)$/i.test(key)) {
      const match = key.match(/^(?:car|vehicle)_(\d+)_/i)
      const index = match ? Number(match[1]) : -1
      if (index >= 0) carSlots = Math.max(carSlots, index + 1)
    }
  }
  return carSlots >= 2
}

export function leadMatchesQualityAttribute(
  lead: DataExportLeadRow,
  attributeId: LeadQualityAttributeId
): boolean {
  const fields = fieldMap(lead)

  switch (attributeId) {
    case "homeowner":
      return isHomeowner(
        pickField(fields, [
          "homeowner",
          "driver_0_homeowner",
          "own_home",
          "residence_status",
          "home_ownership",
        ])
      )
    case "multiVehicle":
      return hasSecondVehicle(fields)
    case "currentlyInsured":
      return isCurrentlyInsured(
        pickField(fields, [
          "currently_insured",
          "currentlyinsured",
          "insured",
          "insurance_status",
          "driver_0_currently_insured",
          "driver_0_insured",
        ])
      )
    case "goodCredit":
      return isGoodOrExcellentCredit(
        pickField(fields, [
          "driver_0_credit",
          "credit",
          "credit_rating",
          "credit_score",
          "driver_0_credit_rating",
        ])
      )
    case "military":
      return isMilitary(
        pickField(fields, [
          "driver_0_military",
          "military",
          "military_affiliation",
          "military_status",
          "active_military",
        ])
      )
    case "married":
      return isMarried(
        pickField(fields, [
          "driver_0_married",
          "married",
          "marital_status",
          "driver_0_marital_status",
        ])
      )
    default:
      return false
  }
}

function formatUtmSource(raw: string): string {
  const value = raw.trim()
  return value || "(none)"
}

export function formatLeadQualityPercent(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return "0%"
  const pct = rate * 100
  if (Number.isInteger(pct) || Math.abs(pct - Math.round(pct)) < 1e-9) {
    return `${Math.round(pct)}%`
  }
  return `${pct.toFixed(1).replace(/\.0$/, "")}%`
}

export function computeLeadQualityByUtmSource(
  leads: DataExportLeadRow[]
): LeadQualityRow[] {
  type Bucket = {
    totalLeads: number
    hits: Record<LeadQualityAttributeId, number>
  }

  const buckets = new Map<string, Bucket>()

  for (const lead of leads) {
    const utmSource = formatUtmSource(lead.utmSource)
    let bucket = buckets.get(utmSource)
    if (!bucket) {
      bucket = {
        totalLeads: 0,
        hits: {
          homeowner: 0,
          multiVehicle: 0,
          currentlyInsured: 0,
          goodCredit: 0,
          military: 0,
          married: 0,
        },
      }
      buckets.set(utmSource, bucket)
    }
    bucket.totalLeads += 1
    for (const attr of LEAD_QUALITY_ATTRIBUTES) {
      if (leadMatchesQualityAttribute(lead, attr.id)) {
        bucket.hits[attr.id] += 1
      }
    }
  }

  return [...buckets.entries()]
    .map(([utmSource, bucket]) => {
      const rates = {} as Record<LeadQualityAttributeId, number>
      for (const attr of LEAD_QUALITY_ATTRIBUTES) {
        rates[attr.id] =
          bucket.totalLeads > 0 ? bucket.hits[attr.id] / bucket.totalLeads : 0
      }
      return {
        utmSource,
        totalLeads: bucket.totalLeads,
        rates,
      }
    })
    .sort((a, b) => {
      if (b.totalLeads !== a.totalLeads) return b.totalLeads - a.totalLeads
      return a.utmSource.localeCompare(b.utmSource)
    })
}

export function emptyLeadQualityRows(): LeadQualityRow[] {
  return []
}

export function hasCompleteLeadQuality(
  rows: LeadQualityRow[] | null | undefined
): boolean {
  return Array.isArray(rows)
}
export function resolveLeadQualityStats(
  leadQuality: LeadQualityRow[] | undefined,
  leads: DataExportLeadRow[],
  complete = false
): { rows: LeadQualityRow[]; complete: boolean } {
  if (complete && Array.isArray(leadQuality)) {
    return { rows: leadQuality, complete: true }
  }
  if (leads.length > 0) {
    return { rows: computeLeadQualityByUtmSource(leads), complete: false }
  }
  return { rows: emptyLeadQualityRows(), complete: false }
}
