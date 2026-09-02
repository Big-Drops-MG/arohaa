import type { DataExportLeadRow } from "@/features/data-export/model/data-export"
import { discoverVisibleLeadFieldKeys } from "@/features/data-export/model/lead-field-columns"
import type { Level1Stat } from "@/features/data-lab/model/level1"

export type Level2Stat = Level1Stat

const VEHICLE_MAKE_NAMES: Record<string, string> = {
  ACU: "Acura",
  ALF: "Alfa Romeo",
  AMC: "AMC",
  AST: "Aston Martin",
  AUD: "Audi",
  BEN: "Bentley",
  BMW: "BMW",
  BUI: "Buick",
  CAD: "Cadillac",
  CHE: "Chevrolet",
  CHR: "Chrysler",
  DAE: "Daewoo",
  DAI: "Daihatsu",
  DOD: "Dodge",
  EAG: "Eagle",
  FER: "Ferrari",
  FIA: "Fiat",
  FOR: "Ford",
  FRE: "Freightliner",
  GEN: "Genesis",
  GEO: "Geo",
  GMC: "GMC",
  HON: "Honda",
  HUM: "Hummer",
  HYU: "Hyundai",
  INF: "Infiniti",
  ISU: "Isuzu",
  JAG: "Jaguar",
  JEE: "Jeep",
  KIA: "Kia",
  LAM: "Lamborghini",
  LAN: "Land Rover",
  LEX: "Lexus",
  LIN: "Lincoln",
  LOT: "Lotus",
  LUC: "Lucid",
  MAS: "Maserati",
  MAY: "Maybach",
  MAZ: "Mazda",
  MCL: "McLaren",
  MEC: "Mercedes-Benz",
  MER: "Mercury",
  MIN: "MINI",
  MIT: "Mitsubishi",
  NIS: "Nissan",
  OLD: "Oldsmobile",
  PLY: "Plymouth",
  POL: "Polestar",
  PON: "Pontiac",
  POR: "Porsche",
  RAM: "Ram",
  RIV: "Rivian",
  ROL: "Rolls-Royce",
  SAA: "Saab",
  SAT: "Saturn",
  SCI: "Scion",
  SMA: "Smart",
  SUB: "Subaru",
  SUZ: "Suzuki",
  TES: "Tesla",
  TOY: "Toyota",
  VIN: "VinFast",
  VOL: "Volvo",
  VW: "Volkswagen",
}

/**
 * Visible Leads-table columns that must not become Level 2 Best cards:
 * fixed table columns, Level 1 overlap (zip/city/state/age), and PII.
 */
const LEVEL2_EXCLUDED_KEY_RE =
  /^(#|email|e-mail|email_address|emailaddress|utm_source|utmsource|utm_id|utmid|trustedform|trustedformurl|trusted_form_url|xxtrustedformcerturl|dob|dob-0-month|dob-0-day|dob-0-year|dob_month|dob_day|dob_year|first_name|firstname|first-name|last_name|lastname|last-name|address|address_line_?1|address_line_?2|address1|address2|unit|unit_number|apt|apartment|mac.?id|macid|mac_id|session|sessionid|session_id|when|created_at|createdat|form_submitted|formsubmitted|age|zip|zipcode|zip_code|postal|city|state|lang|language|languages|locale|preferred_?language|googtrans|translated_?languages?)$/i

function isExcludedLevel2Key(key: string): boolean {
  const trimmed = key.trim()
  if (!trimmed) return true
  if (LEVEL2_EXCLUDED_KEY_RE.test(trimmed)) return true
  if (/^address(_line_?[12])?$/i.test(trimmed)) return true
  if (/^dob/i.test(trimmed)) return true
  if (/trustedform/i.test(trimmed)) return true
  return false
}

function humanizeColumnLabel(key: string): string {
  return key
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function level2StatId(key: string): string {
  return `best-${key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`
}

export function filterLevel2StatsToVisibleLeadColumns(
  stats: Level2Stat[],
  leads: DataExportLeadRow[]
): Level2Stat[] {
  const visibleStatIds = new Set(
    discoverLevel2ColumnKeys(leads).map(level2StatId)
  )
  return stats.filter((stat) => visibleStatIds.has(stat.id))
}

function normalizeLevel2Value(raw: string): string | null {
  const trimmed = raw.trim()
  return trimmed ? trimmed : null
}

function normalizeVehicleMake(key: string, value: string): string {
  if (!/(?:^|_)(?:make|manufacturer)$/i.test(key.trim())) return value
  return VEHICLE_MAKE_NAMES[value.trim().toUpperCase()] ?? value
}

type RatioKind = {
  firstLabel: "Yes" | "Male"
  secondLabel: "No" | "Female"
}

function canonicalRatioValue(
  raw: string
): "Yes" | "No" | "Male" | "Female" | null {
  const value = raw.trim().toLowerCase()
  if (["yes", "true", "1", "on", "y"].includes(value)) return "Yes"
  if (["no", "false", "0", "off", "n"].includes(value)) return "No"
  if (["male", "m"].includes(value)) return "Male"
  if (["female", "f"].includes(value)) return "Female"
  return null
}

function ratioKindForValues(values: Iterable<string>): RatioKind | null {
  let kind: "yes-no" | "gender" | null = null
  let hasValue = false
  for (const raw of values) {
    const value = canonicalRatioValue(raw)
    if (!value) return null
    hasValue = true
    const nextKind = value === "Yes" || value === "No" ? "yes-no" : "gender"
    if (kind && kind !== nextKind) return null
    kind = nextKind
  }
  if (!hasValue || !kind) return null
  return kind === "yes-no"
    ? { firstLabel: "Yes", secondLabel: "No" }
    : { firstLabel: "Male", secondLabel: "Female" }
}

function formatPercentShare(part: number, total: number): string {
  if (total <= 0) return "0%"
  const pct = (part / total) * 100
  const rounded =
    Number.isInteger(pct) || Math.abs(pct - Math.round(pct)) < 1e-9
      ? String(Math.round(pct))
      : pct.toFixed(1).replace(/\.0$/, "")
  return `${rounded}%`
}

function ratioStat(
  key: string,
  counts: Map<string, number>,
  kind: RatioKind
): Level2Stat {
  let firstCount = 0
  let secondCount = 0
  for (const [raw, count] of counts) {
    const value = canonicalRatioValue(raw)
    if (value === kind.firstLabel) firstCount += count
    if (value === kind.secondLabel) secondCount += count
  }
  const total = firstCount + secondCount
  return {
    id: level2StatId(key),
    label: `${humanizeColumnLabel(key)} Ratio (${kind.firstLabel} : ${kind.secondLabel})`,
    value:
      total > 0
        ? `${formatPercentShare(firstCount, total)} : ${formatPercentShare(secondCount, total)}`
        : "—",
    breakdown: [
      { label: kind.firstLabel, value: firstCount },
      { label: kind.secondLabel, value: secondCount },
    ],
    enoughData: total > 0,
  }
}

function pickBestCountKey(counts: Map<string, number>): {
  key: string | null
  count: number
} {
  let bestKey: string | null = null
  let bestCount = 0
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestKey = key
      bestCount = count
    }
  }
  return { key: bestKey, count: bestCount }
}

/**
 * Level 2 columns = visible Leads-table field columns, minus fixed / Level 1 /
 * PII columns. Never invent keys that are not shown in the table.
 */
export function discoverLevel2ColumnKeys(leads: DataExportLeadRow[]): string[] {
  return discoverVisibleLeadFieldKeys(leads).filter(
    (key) => !isExcludedLevel2Key(key)
  )
}

function readLeadColumnValue(
  lead: DataExportLeadRow,
  key: string
): string | null {
  const raw = lead.fields?.[key]
  if (raw == null) return null
  const normalized = normalizeLevel2Value(String(raw))
  return normalized ? normalizeVehicleMake(key, normalized) : null
}

export function computeLevel2StatsFromLeads(
  leads: DataExportLeadRow[]
): Level2Stat[] {
  const columnKeys = discoverLevel2ColumnKeys(leads)
  if (columnKeys.length === 0) return []

  const countsByColumn = new Map<string, Map<string, number>>()
  for (const key of columnKeys) {
    countsByColumn.set(key, new Map())
  }

  for (const lead of leads) {
    if (!lead.formSubmitted) continue
    for (const key of columnKeys) {
      const value = readLeadColumnValue(lead, key)
      if (!value) continue
      const counts = countsByColumn.get(key)!
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }

  return columnKeys.map((key) => {
    const counts = countsByColumn.get(key) ?? new Map()
    const ratioKind = ratioKindForValues(counts.keys())
    if (ratioKind) return ratioStat(key, counts, ratioKind)
    const best = pickBestCountKey(counts)
    return {
      id: level2StatId(key),
      label: `Best ${humanizeColumnLabel(key)}`,
      value: best.count > 0 && best.key ? best.key : "—",
      metricLabel: "Form submissions",
      metricValue: best.count,
      enoughData: best.count > 0,
    }
  })
}

export function emptyLevel2Stats(): Level2Stat[] {
  return []
}

export function resolveLevel2Stats(
  level2Stats: Level2Stat[] | undefined,
  leads: DataExportLeadRow[],
  completeFromApi: boolean
): { stats: Level2Stat[]; complete: boolean } {
  if (completeFromApi && Array.isArray(level2Stats)) {
    return { stats: level2Stats, complete: true }
  }
  return { stats: computeLevel2StatsFromLeads(leads), complete: false }
}
