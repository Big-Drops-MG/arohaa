import type { DataExportLeadRow } from "@/features/data-export/model/data-export"

const PREFERRED_FIELD_ORDER = [
  "dob",
  "first_name",
  "last_name",
  "address",
  "city",
  "state",
] as const

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
  return [...keys].sort((a, b) => {
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
