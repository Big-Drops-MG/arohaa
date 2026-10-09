import type { DataExportLeadRow } from "@/features/data-export/model/data-export"

/** Dynamic lead field columns, highest-priority identity/geo first. */
const PREFERRED_FIELD_ORDER = [
  "first_name",
  "last_name",
  "address",
  "city",
  "state",
  "dob",
] as const

const LABEL_OVERRIDES: Record<string, string> = {
  dob: "Date of Birth",
  "dob-0-month": "Date of Birth (Month)",
  "dob-0-day": "Date of Birth (Day)",
  "dob-0-year": "Date of Birth (Year)",
  dob_month: "Date of Birth (Month)",
  dob_day: "Date of Birth (Day)",
  dob_year: "Date of Birth (Year)",
  first_name: "First Name",
  last_name: "Last Name",
  zip: "Zip",
  zipcode: "Zip",
  zip_code: "Zip",
  postal: "Zip",
  email: "Email",
  phone: "Phone",
  address: "Address",
  city: "City",
  state: "State",
  utm_source: "UTM Source",
  utm_id: "UTM ID",
  utm_s1: "UTM S1",
  mac_id: "MAC ID",
  submit: "Submit",
  unnamed: "Unknown Control",
}

/**
 * Dynamic field columns shown in the Leads table: union of keys present on
 * lead.fields (already normalized / phone-stripped by the API).
 */
export function discoverVisibleLeadFieldKeys(
  leads: Array<Pick<DataExportLeadRow, "fields">>
): string[] {
  const keys = new Set<string>()
  for (const lead of leads) {
    for (const key of Object.keys(lead.fields ?? {})) {
      const trimmed = key.trim()
      if (trimmed) keys.add(trimmed)
    }
  }
  return sortLeadFieldKeys([...keys])
}

export function sortLeadFieldKeys(keys: string[]): string[] {
  const preferred = new Map(
    PREFERRED_FIELD_ORDER.map((key, index) => [key, index])
  )
  return [...keys]
    .filter((key) => {
      const lower = key.trim().toLowerCase()
      return lower !== "first_name" && lower !== "last_name"
    })
    .sort((a, b) => {
      const ai = preferred.get(
        a.toLowerCase() as (typeof PREFERRED_FIELD_ORDER)[number]
      )
      const bi = preferred.get(
        b.toLowerCase() as (typeof PREFERRED_FIELD_ORDER)[number]
      )
      if (ai != null && bi != null) return ai - bi
      if (ai != null) return -1
      if (bi != null) return 1
      return a.localeCompare(b)
    })
}

/** Display label for lead field keys (`first_name` → `First Name`). */
export function humanizeLeadFieldLabel(key: string): string {
  const trimmed = key.trim()
  if (!trimmed) return ""
  const override = LABEL_OVERRIDES[trimmed.toLowerCase()]
  if (override) return override
  return trimmed
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}
