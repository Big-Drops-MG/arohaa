import { getClickHouseClient } from './clickhouse.service.js'
import {
  rangeFilter,
  rangeQueryParams,
  resolveAnalyticsWindow,
  type AnalyticsCustomRange,
  type AnalyticsRangeId,
} from '../lib/analytics-range.js'
import {
  formatAnalyticsHourWindow,
  getAnalyticsEtParts,
} from '../lib/analytics-timezone.js'
import {
  fieldsWithoutReserved,
  isDisplayableLead,
  normalizeLeadFields,
  pickLeadEmail,
  pickLeadZip,
  pickTrustedFormUrl,
} from '../lib/lead-fields.js'
import type {
  IntelligenceBoard,
  IntelligenceWinner,
  Level1Stat,
  Level2Stat,
  Level3Payload,
} from '../types/analytics-insights.js'
import { resolveVehicleNamesInLeads } from '../lib/vehicle-model-names.js'

type CHJson<T> = { data: T[] }

const SUBMIT_EVENTS = `event_name IN ('form_success', 'service_click')`

export type FunnelLeadRow = {
  sessionId: string
  macId: string
  createdAt: string
  submittedAt: string | null
  zip: string
  email: string
  utmSource: string
  utmId: string
  trustedFormUrl: string
  formSubmitted: boolean
  fields: Record<string, string>
}

export type FunnelLeadsResponse = {
  rangeId: AnalyticsRangeId
  leads: FunnelLeadRow[]
  visibleLeadFieldKeys: string[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
  level1Stats: Level1Stat[]
  level2Stats: Level2Stat[]
  level3: Level3Payload
}

type RawLeadSessionRow = {
  session_id: string
  fingerprint: string
  last_at: string
  submitted_at: string
  props: string
  form_submitted: number | boolean | string
  sample_url: string
  zip_val: string
  utm_source: string
  utm_id: string
}

/** Max raw sessions scanned per request (safety ceiling for a date window). */
const MAX_RAW_SESSIONS = 20_000
const LEVEL3_MIN_SAMPLE = 6

function extractRawFieldMap(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const props = parsed as Record<string, unknown>
    const source =
      props.fields && typeof props.fields === 'object' && !Array.isArray(props.fields)
        ? (props.fields as Record<string, unknown>)
        : props
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(source)) {
      if (k === 'fields' || k === '_k') continue
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        out[k] = String(v)
      }
    }
    return out
  } catch {
    return {}
  }
}

function pickQueryParam(url: string, keys: string[]): string {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    for (const key of keys) {
      const value = (parsed.searchParams.get(key) || '').trim()
      if (value) return value.slice(0, 200)
    }
  } catch {
    /* ignore malformed urls */
  }
  return ''
}

function resolveLeadUtm(input: {
  utmSource?: string
  utmId?: string
  url?: string
}): { utmSource: string; utmId: string } {
  const url = input.url || ''
  return {
    utmSource:
      (input.utmSource || '').trim() ||
      pickQueryParam(url, ['utm_source', 'sid']),
    utmId:
      (input.utmId || '').trim() ||
      pickQueryParam(url, ['utm_id', 'tid', 'uid']),
  }
}

function isLeadFormSubmitted(value: number | boolean | string): boolean {
  if (value === true || value === 1 || value === '1') return true
  if (value === false || value === 0 || value === '0') return false
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === 'yes'
  }
  return Boolean(value)
}

function isValidLeadTimestamp(value: string | null | undefined): boolean {
  if (!value) return false
  const trimmed = value.trim()
  if (!trimmed || trimmed.startsWith('1970-')) return false
  return !Number.isNaN(new Date(trimmed.replace(' ', 'T')).getTime())
}

export function formatFingerprintAsMacId(fingerprint: string): string {
  const hex = fingerprint.replace(/[^a-fA-F0-9]/g, '').toLowerCase()
  if (!hex) return ''
  const padded = hex.padEnd(12, '0').slice(0, 12)
  return padded.match(/.{2}/g)?.join(':') ?? ''
}

function toFunnelLead(row: RawLeadSessionRow): FunnelLeadRow {
  const rawFields = extractRawFieldMap(row.props || '{}')
  const fields = normalizeLeadFields(rawFields)
  const email = pickLeadEmail(fields)
  const zip = row.zip_val || pickLeadZip(fields) || ''
  const utm = resolveLeadUtm({
    utmSource: row.utm_source,
    utmId: row.utm_id,
    url: row.sample_url,
  })
  const formSubmitted = isLeadFormSubmitted(row.form_submitted)
  const submittedAt = isValidLeadTimestamp(row.submitted_at)
    ? row.submitted_at.trim()
    : null
  return {
    sessionId: row.session_id,
    macId: formatFingerprintAsMacId(row.fingerprint || ''),
    createdAt: row.last_at,
    submittedAt,
    zip,
    email,
    utmSource: utm.utmSource,
    utmId: utm.utmId,
    trustedFormUrl: pickTrustedFormUrl(rawFields),
    formSubmitted,
    fields: fieldsWithoutReserved(fields),
  }
}

/** Same parsing as the leads table When column. */
function parseLeadWhen(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed || trimmed.startsWith('1970-')) return null
  const date = new Date(
    trimmed.includes('T') ? trimmed : `${trimmed.replace(' ', 'T')}Z`,
  )
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeLeadZip(value: string | null | undefined): string | null {
  const zip = String(value ?? '').trim()
  return zip ? zip : null
}

function pickFieldValue(
  fields: Record<string, string> | null | undefined,
  keys: string[],
): string | null {
  if (!fields) return null
  const byLower = new Map<string, string>()
  for (const [key, value] of Object.entries(fields)) {
    const trimmed = String(value ?? '').trim()
    if (!trimmed) continue
    byLower.set(key.trim().toLowerCase(), trimmed)
  }
  for (const key of keys) {
    const value = byLower.get(key.toLowerCase())
    if (value) return value
  }
  return null
}

function parseDobParts(
  raw: string,
): { month: number; day: number; year: number } | null {
  const match = raw.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (!match) return null
  const month = Number(match[1])
  const day = Number(match[2])
  const year = Number(match[3])
  if (
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    year < 1900
  ) {
    return null
  }
  return { month, day, year }
}

function ageFromDob(
  raw: string | null | undefined,
  now: { year: number; month: number; day: number },
): number | null {
  if (!raw?.trim()) return null
  const parts = parseDobParts(raw)
  if (!parts) return null
  let age = now.year - parts.year
  if (
    now.month < parts.month ||
    (now.month === parts.month && now.day < parts.day)
  ) {
    age -= 1
  }
  if (age < 0 || age > 120) return null
  return age
}

function ageGroupFromAge(age: number): string | null {
  if (!Number.isFinite(age) || age < 0 || age > 120) return null
  if (age < 25) return 'Under 25'
  if (age < 35) return '25-34'
  if (age < 45) return '35-44'
  if (age < 55) return '45-54'
  if (age < 65) return '55-64'
  return '65+'
}

const US_STATE_CODE_TO_NAME: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
}

const US_STATE_NAME_BY_LOWER = new Map(
  Object.values(US_STATE_CODE_TO_NAME).map((name) => [name.toLowerCase(), name]),
)

function normalizeLeadStateName(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  const byCode = US_STATE_CODE_TO_NAME[trimmed.toUpperCase()]
  if (byCode) return byCode
  const byName = US_STATE_NAME_BY_LOWER.get(trimmed.toLowerCase())
  if (byName) return byName
  return trimmed
}

const LEVEL2_EXCLUDED_KEY_RE =
  /^(#|email|e-mail|email_address|emailaddress|utm_source|utmsource|utm_id|utmid|trustedform|trustedformurl|trusted_form_url|xxtrustedformcerturl|dob|dob-0-month|dob-0-day|dob-0-year|dob_month|dob_day|dob_year|first_name|firstname|first-name|last_name|lastname|last-name|address|address_line_?1|address_line_?2|address1|address2|unit|unit_number|apt|apartment|mac.?id|macid|mac_id|session|sessionid|session_id|when|created_at|createdat|form_submitted|formsubmitted|age|zip|zipcode|zip_code|postal|city|state|lang|language|languages|locale|preferred_?language|googtrans|translated_?languages?)$/i

const VEHICLE_MAKE_NAMES: Record<string, string> = {
  ACU: 'Acura',
  ALF: 'Alfa Romeo',
  AMC: 'AMC',
  AST: 'Aston Martin',
  AUD: 'Audi',
  BEN: 'Bentley',
  BMW: 'BMW',
  BUI: 'Buick',
  CAD: 'Cadillac',
  CHE: 'Chevrolet',
  CHR: 'Chrysler',
  DAE: 'Daewoo',
  DAI: 'Daihatsu',
  DOD: 'Dodge',
  EAG: 'Eagle',
  FER: 'Ferrari',
  FIA: 'Fiat',
  FOR: 'Ford',
  FRE: 'Freightliner',
  GEN: 'Genesis',
  GEO: 'Geo',
  GMC: 'GMC',
  HON: 'Honda',
  HUM: 'Hummer',
  HYU: 'Hyundai',
  INF: 'Infiniti',
  ISU: 'Isuzu',
  JAG: 'Jaguar',
  JEE: 'Jeep',
  KIA: 'Kia',
  LAM: 'Lamborghini',
  LAN: 'Land Rover',
  LEX: 'Lexus',
  LIN: 'Lincoln',
  LOT: 'Lotus',
  LUC: 'Lucid',
  MAS: 'Maserati',
  MAY: 'Maybach',
  MAZ: 'Mazda',
  MCL: 'McLaren',
  MEC: 'Mercedes-Benz',
  MER: 'Mercury',
  MIN: 'MINI',
  MIT: 'Mitsubishi',
  NIS: 'Nissan',
  OLD: 'Oldsmobile',
  PLY: 'Plymouth',
  POL: 'Polestar',
  PON: 'Pontiac',
  POR: 'Porsche',
  RAM: 'Ram',
  RIV: 'Rivian',
  ROL: 'Rolls-Royce',
  SAA: 'Saab',
  SAT: 'Saturn',
  SCI: 'Scion',
  SMA: 'Smart',
  SUB: 'Subaru',
  SUZ: 'Suzuki',
  TES: 'Tesla',
  TOY: 'Toyota',
  VIN: 'VinFast',
  VOL: 'Volvo',
  VW: 'Volkswagen',
}

function isExcludedLevel2Key(key: string): boolean {
  const trimmed = key.trim()
  if (!trimmed) return true
  if (LEVEL2_EXCLUDED_KEY_RE.test(trimmed)) return true
  if (/^address(_line_?[12])?$/i.test(trimmed)) return true
  if (/^dob/i.test(trimmed)) return true
  if (/trustedform/i.test(trimmed)) return true
  return false
}

function humanizeLevel2ColumnLabel(key: string): string {
  return key
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function level2StatId(key: string): string {
  return `best-${key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function normalizeLevel2Value(raw: string): string | null {
  const trimmed = raw.trim()
  return trimmed ? trimmed : null
}

function normalizeVehicleMake(key: string, value: string): string {
  if (!/(?:^|_)(?:make|manufacturer)$/i.test(key.trim())) return value
  return VEHICLE_MAKE_NAMES[value.trim().toUpperCase()] ?? value
}

type Level2RatioKind = {
  firstLabel: 'Yes' | 'Male'
  secondLabel: 'No' | 'Female'
}

function canonicalLevel2RatioValue(
  raw: string,
): 'Yes' | 'No' | 'Male' | 'Female' | null {
  const value = raw.trim().toLowerCase()
  if (['yes', 'true', '1', 'on', 'y'].includes(value)) return 'Yes'
  if (['no', 'false', '0', 'off', 'n'].includes(value)) return 'No'
  if (['male', 'm'].includes(value)) return 'Male'
  if (['female', 'f'].includes(value)) return 'Female'
  return null
}

function level2RatioKindForValues(
  values: Iterable<string>,
): Level2RatioKind | null {
  let kind: 'yes-no' | 'gender' | null = null
  let hasValue = false
  for (const raw of values) {
    const value = canonicalLevel2RatioValue(raw)
    if (!value) return null
    hasValue = true
    const nextKind = value === 'Yes' || value === 'No' ? 'yes-no' : 'gender'
    if (kind && kind !== nextKind) return null
    kind = nextKind
  }
  if (!hasValue || !kind) return null
  return kind === 'yes-no'
    ? { firstLabel: 'Yes', secondLabel: 'No' }
    : { firstLabel: 'Male', secondLabel: 'Female' }
}

function level2RatioStat(
  key: string,
  counts: Map<string, number>,
  kind: Level2RatioKind,
): Level2Stat {
  let firstCount = 0
  let secondCount = 0
  for (const [raw, count] of counts) {
    const value = canonicalLevel2RatioValue(raw)
    if (value === kind.firstLabel) firstCount += count
    if (value === kind.secondLabel) secondCount += count
  }
  const total = firstCount + secondCount
  return {
    id: level2StatId(key),
    label: `${humanizeLevel2ColumnLabel(key)} Ratio (${kind.firstLabel} : ${kind.secondLabel})`,
    value:
      total > 0
        ? `${formatPercentShare(firstCount, total)} : ${formatPercentShare(secondCount, total)}`
        : '—',
    breakdown: [
      { label: kind.firstLabel, value: firstCount },
      { label: kind.secondLabel, value: secondCount },
    ],
    enoughData: total > 0,
  }
}

/** Same source as the Leads table dynamic columns: keys present on lead.fields. */
function discoverVisibleLeadFieldKeys(leads: FunnelLeadRow[]): string[] {
  const keys = new Set<string>()
  for (const lead of leads) {
    for (const key of Object.keys(lead.fields ?? {})) {
      const trimmed = key.trim()
      if (trimmed) keys.add(trimmed)
    }
  }
  return [...keys].sort((a, b) => a.localeCompare(b))
}

function discoverLevel2ColumnKeys(leads: FunnelLeadRow[]): string[] {
  return discoverVisibleLeadFieldKeys(leads).filter(
    (key) => !isExcludedLevel2Key(key),
  )
}

function readLeadLevel2Value(lead: FunnelLeadRow, key: string): string | null {
  const raw = lead.fields?.[key]
  if (raw == null) return null
  const normalized = normalizeLevel2Value(String(raw))
  return normalized ? normalizeVehicleMake(key, normalized) : null
}

export function computeLevel2StatsFromLeads(leads: FunnelLeadRow[]): Level2Stat[] {
  const columnKeys = discoverLevel2ColumnKeys(leads)
  if (columnKeys.length === 0) return []

  // For ratio columns: count submitted leads per value (unchanged)
  const submittedCountsByColumn = new Map<string, Map<string, number>>()
  // For best-X columns: track total+submitted per value for Wilson scoring
  type L2Bucket = { value: string; total: number; submitted: number }
  const efficiencyByColumn = new Map<string, Map<string, L2Bucket>>()

  for (const key of columnKeys) {
    submittedCountsByColumn.set(key, new Map())
    efficiencyByColumn.set(key, new Map())
  }

  for (const lead of leads) {
    for (const key of columnKeys) {
      const value = readLeadLevel2Value(lead, key)
      if (!value) continue

      const eff = efficiencyByColumn.get(key)!
      const existing = eff.get(value) ?? { value, total: 0, submitted: 0 }
      existing.total += 1
      if (lead.formSubmitted) existing.submitted += 1
      eff.set(value, existing)

      if (lead.formSubmitted) {
        const counts = submittedCountsByColumn.get(key)!
      counts.set(value, (counts.get(value) ?? 0) + 1)
      }
    }
  }

  return columnKeys.map((key) => {
    const submittedCounts = submittedCountsByColumn.get(key) ?? new Map()
    const ratioKind = level2RatioKindForValues(submittedCounts.keys())
    if (ratioKind) return level2RatioStat(key, submittedCounts, ratioKind)

    const effBuckets = efficiencyByColumn.get(key) ?? new Map()
    let best: L2Bucket | null = null
    let bestScore = -1
    for (const bucket of effBuckets.values()) {
      if (bucket.submitted === 0) continue
      const p = bucket.submitted / bucket.total
      const z = 1.64, z2 = z * z
      const score = Math.max(0, (p + z2 / (2 * bucket.total) - z * Math.sqrt((p * (1 - p) + z2 / (4 * bucket.total)) / bucket.total)) / (1 + z2 / bucket.total))
      if (score > bestScore || (score === bestScore && (best === null || bucket.submitted > best.submitted))) {
        best = bucket; bestScore = score
      }
    }

    const rate =
      best && best.total > 0
        ? formatPercentShare(best.submitted, best.total)
        : undefined

    return {
      id: level2StatId(key),
      label: `Best ${humanizeLevel2ColumnLabel(key)}`,
      value: best && best.submitted > 0 ? best.value : '\u2014',
      metricLabel: 'Submitted leads',
      metricValue: best?.submitted ?? 0,
      sampleSize: best?.total,
      submissionRate: rate,
      enoughData: (best?.submitted ?? 0) > 0,
    }
  })
}


function resolveLeadAge(
  fields: Record<string, string> | null | undefined,
  now: { year: number; month: number; day: number },
): number | null {
  const dob = pickFieldValue(fields, ['dob'])
  const fromDob = ageFromDob(dob, now)
  if (fromDob != null) return fromDob

  const rawAge = pickFieldValue(fields, ['driver_0_age', 'age'])
  if (!rawAge) return null
  const age = Number(rawAge.replace(/\D/g, ''))
  if (!Number.isFinite(age) || age < 0 || age > 120) return null
  return age
}

function formatPercentShare(part: number, total: number): string {
  if (total <= 0) return '0%'
  const pct = (part / total) * 100
  const rounded =
    Number.isInteger(pct) || Math.abs(pct - Math.round(pct)) < 1e-9
      ? String(Math.round(pct))
      : pct.toFixed(1).replace(/\.0$/, '')
  return `${rounded}%`
}

/** Yes:No share of all leads, as percentages of the total. */
function formatYesNoRatio(yesCount: number, noCount: number): string {
  const total = yesCount + noCount
  if (total <= 0) return '—'
  return `${formatPercentShare(yesCount, total)} : ${formatPercentShare(noCount, total)}`
}

/** Wilson score lower bound for credible efficiency ranking. */
function calculateL1CredibleRate(
  submitted: number,
  total: number,
  z = 1.64,
): number {
  if (total <= 0 || submitted <= 0) return 0
  const p = submitted / total
  const z2 = z * z
  const denominator = 1 + z2 / total
  const centerAdjusted = p + z2 / (2 * total)
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total)
  return Math.max(0, (centerAdjusted - margin) / denominator)
}

type L1BucketCounter = {
  label: string
  total: number
  submitted: number
}

function addL1Bucket(
  counts: Map<string, L1BucketCounter>,
  label: string,
  submitted: boolean,
): void {
  const next = counts.get(label) ?? { label, total: 0, submitted: 0 }
  next.total += 1
  if (submitted) next.submitted += 1
  counts.set(label, next)
}

function pickBestL1Bucket(
  counts: Map<string, L1BucketCounter>,
): L1BucketCounter | null {
  let best: L1BucketCounter | null = null
  let bestScore = -1
  for (const bucket of counts.values()) {
    if (bucket.submitted === 0) continue
    const score = calculateL1CredibleRate(bucket.submitted, bucket.total)
    if (
      score > bestScore ||
      (score === bestScore && (best === null || bucket.submitted > best.submitted))
    ) {
      best = bucket
      bestScore = score
    }
  }
  return best
}

export function computeLevel1StatsFromLeads(leads: FunnelLeadRow[]): Level1Stat[] {
  // Wilson-scored buckets for efficiency-ranked dimensions
  const timeBuckets = new Map<string, L1BucketCounter>()
  const ageGroupBuckets = new Map<string, L1BucketCounter>()
  const cityBuckets = new Map<string, L1BucketCounter>()
  const stateBuckets = new Map<string, L1BucketCounter>()

  // ZIP stays as highest-submission-count (too granular for credible scoring),
  // but we still track total leads so the UI can show "3 of 5" context.
  const zipBuckets = new Map<string, L1BucketCounter>()

  let yesCount = 0
  let noCount = 0
  const now = getAnalyticsEtParts(new Date())

  for (const lead of leads) {
    if (lead.formSubmitted) yesCount += 1
    else noCount += 1

    const when = parseLeadWhen(lead.createdAt)
    if (when) {
      const hour = getAnalyticsEtParts(when).hour
      addL1Bucket(timeBuckets, formatAnalyticsHourWindow(hour), lead.formSubmitted)
    }

    const age = resolveLeadAge(lead.fields, now)
    const ageGroup = age != null ? ageGroupFromAge(age) : null
    if (ageGroup) {
      addL1Bucket(ageGroupBuckets, ageGroup, lead.formSubmitted)
    }

    const city = pickFieldValue(lead.fields, ['city'])
    if (city) {
      addL1Bucket(cityBuckets, city, lead.formSubmitted)
    }

    const stateRaw = pickFieldValue(lead.fields, ['state'])
    const state = stateRaw ? normalizeLeadStateName(stateRaw) : null
    if (state) {
      addL1Bucket(stateBuckets, state, lead.formSubmitted)
    }

    const zip = normalizeLeadZip(lead.zip)
    if (zip) addL1Bucket(zipBuckets, zip, lead.formSubmitted)
  }

  const bestTime = pickBestL1Bucket(timeBuckets)
  const bestAgeGroup = pickBestL1Bucket(ageGroupBuckets)
  const bestCity = pickBestL1Bucket(cityBuckets)
  const bestState = pickBestL1Bucket(stateBuckets)

  let bestZip: L1BucketCounter | null = null
  for (const bucket of zipBuckets.values()) {
    if (
      !bestZip ||
      bucket.submitted > bestZip.submitted ||
      (bucket.submitted === bestZip.submitted && bucket.total > bestZip.total)
    ) {
      bestZip = bucket
    }
  }

  const totalLeads = yesCount + noCount

  return [
    {
      id: 'best-time',
      label: 'Best Time',
      value: bestTime ? bestTime.label : '—',
      metricLabel: 'Submitted leads',
      metricValue: bestTime?.submitted ?? 0,
      sampleSize: bestTime?.total,
      submissionRate:
        bestTime && bestTime.total > 0
          ? formatPercentShare(bestTime.submitted, bestTime.total)
          : undefined,
      enoughData: (bestTime?.submitted ?? 0) > 0,
    },
    {
      id: 'best-zip',
      label: 'Best ZIP',
      value: bestZip?.label ?? '—',
      metricLabel: 'Submitted leads',
      metricValue: bestZip?.submitted ?? 0,
      sampleSize: bestZip?.total,
      submissionRate:
        bestZip && bestZip.total > 0
          ? formatPercentShare(bestZip.submitted, bestZip.total)
          : undefined,
      enoughData: (bestZip?.submitted ?? 0) > 0,
    },
    {
      id: 'form-submission-ratio',
      label: 'Form Submission Ratio',
      value: totalLeads > 0 ? formatYesNoRatio(yesCount, noCount) : '—',
      breakdown: [
        { label: 'Submitted', value: yesCount },
        { label: 'Not submitted', value: noCount },
      ],
      enoughData: totalLeads > 0,
    },
    {
      id: 'best-age-group',
      label: 'Best Age Group',
      value: bestAgeGroup?.label ?? '—',
      metricLabel: 'Submitted leads',
      metricValue: bestAgeGroup?.submitted ?? 0,
      sampleSize: bestAgeGroup?.total,
      submissionRate:
        bestAgeGroup && bestAgeGroup.total > 0
          ? formatPercentShare(bestAgeGroup.submitted, bestAgeGroup.total)
          : undefined,
      enoughData: (bestAgeGroup?.submitted ?? 0) > 0,
    },
    {
      id: 'best-city',
      label: 'Best City',
      value: bestCity?.label ?? '—',
      metricLabel: 'Submitted leads',
      metricValue: bestCity?.submitted ?? 0,
      sampleSize: bestCity?.total,
      submissionRate:
        bestCity && bestCity.total > 0
          ? formatPercentShare(bestCity.submitted, bestCity.total)
          : undefined,
      enoughData: (bestCity?.submitted ?? 0) > 0,
    },
    {
      id: 'best-state',
      label: 'Best State',
      value: bestState?.label ?? '—',
      metricLabel: 'Submitted leads',
      metricValue: bestState?.submitted ?? 0,
      sampleSize: bestState?.total,
      submissionRate:
        bestState && bestState.total > 0
          ? formatPercentShare(bestState.submitted, bestState.total)
          : undefined,
      enoughData: (bestState?.submitted ?? 0) > 0,
    },
  ]
}

type Level3BucketCounter = {
  label: string
  total: number
  submitted: number
}

type Level3BucketRow = Level3BucketCounter & {
  submissionRate: number
  shareOfSubmitted: number
  credibleScore: number
}

function calculateLevel3CredibleRate(
  submitted: number,
  total: number,
  z = 1.64,
): number {
  if (total <= 0 || submitted <= 0) return 0
  const p = submitted / total
  const z2 = z * z
  const denominator = 1 + z2 / total
  const centerAdjusted = p + z2 / (2 * total)
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total)
  return Math.max(0, (centerAdjusted - margin) / denominator)
}

function formatPercent(value: number): string {
  return `${formatPercentShare(value, 100)}`
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function normalizeLevel3Source(value: string): string {
  const trimmed = value.trim()
  return trimmed || '(direct)'
}

function hasVisibleLeadField(
  visibleLeadFieldKeys: string[],
  candidates: string[],
): boolean {
  const visible = new Set(visibleLeadFieldKeys.map((key) => key.trim().toLowerCase()))
  return candidates.some((candidate) => visible.has(candidate.toLowerCase()))
}

function addLevel3Bucket(
  counts: Map<string, Level3BucketCounter>,
  label: string,
  submitted: boolean,
): void {
  const next = counts.get(label) ?? { label, total: 0, submitted: 0 }
  next.total += 1
  if (submitted) next.submitted += 1
  counts.set(label, next)
}

function finalizeLevel3Buckets(
  counts: Map<string, Level3BucketCounter>,
): Level3BucketRow[] {
  const rows = [...counts.values()]
  const totalSubmitted = rows.reduce((sum, row) => sum + row.submitted, 0)

  return rows
    .map((row) => {
      const submissionRate = row.total > 0 ? round1((row.submitted / row.total) * 100) : 0
      const shareOfSubmitted =
        totalSubmitted > 0 ? round1((row.submitted / totalSubmitted) * 100) : 0
      const credibleScore = calculateLevel3CredibleRate(row.submitted, row.total)
      return {
        ...row,
        submissionRate,
        shareOfSubmitted,
        credibleScore,
      }
    })
    .sort((a, b) => {
      // Prefer buckets with enough sample for a reliable read, then Wilson score.
      // This keeps tiny 100% cells from beating real volume, without letting a
      // weak large bucket (e.g. 3/8) outrank a stronger mid-size bucket (e.g. 5/6).
      const aQualified = a.total >= LEVEL3_MIN_SAMPLE && a.submitted > 0 ? 1 : 0
      const bQualified = b.total >= LEVEL3_MIN_SAMPLE && b.submitted > 0 ? 1 : 0
      if (bQualified !== aQualified) return bQualified - aQualified
      return (
        b.credibleScore - a.credibleScore ||
        b.submitted - a.submitted ||
        b.submissionRate - a.submissionRate ||
        b.total - a.total ||
        a.label.localeCompare(b.label)
      )
    })
}

function rankLevel3Dimension(
  leads: FunnelLeadRow[],
  readLabel: (lead: FunnelLeadRow) => string | null,
): Level3BucketRow[] {
  const counts = new Map<string, Level3BucketCounter>()
  for (const lead of leads) {
    const label = readLabel(lead)
    if (!label) continue
    addLevel3Bucket(counts, label, lead.formSubmitted)
  }
  return finalizeLevel3Buckets(counts)
}

function rankLevel3Pairs(
  leads: FunnelLeadRow[],
  readLeft: (lead: FunnelLeadRow) => string | null,
  readRight: (lead: FunnelLeadRow) => string | null,
): Level3BucketRow[] {
  const counts = new Map<string, Level3BucketCounter>()
  for (const lead of leads) {
    const left = readLeft(lead)
    const right = readRight(lead)
    if (!left || !right) continue
    addLevel3Bucket(counts, `${left} x ${right}`, lead.formSubmitted)
  }
  return finalizeLevel3Buckets(counts)
}

function pickLevel3Winner(rows: Level3BucketRow[]): Level3BucketRow | null {
  if (rows.length === 0) return null
  const qualified = rows.filter(
    (row) => row.total >= LEVEL3_MIN_SAMPLE && row.submitted > 0,
  )
  if (qualified.length > 0) return qualified[0]!

  const withConversions = rows.filter((row) => row.submitted > 0)
  if (withConversions.length > 0) return withConversions[0]!

  return rows[0] ?? null
}

function createLevel3WinnerCard(
  id: string,
  label: string,
  rows: Level3BucketRow[],
): IntelligenceWinner {
  const best = pickLevel3Winner(rows)
  return {
    id,
    label,
    value: best?.label ?? '—',
    metricLabel: 'Submitted leads',
    metricValue: best?.submitted ?? 0,
    secondaryLabel: 'Submission rate',
    secondaryValue: best
      ? `${formatPercent(best.submissionRate)} (${best.submitted}/${best.total} leads)`
      : '—',
    sampleSize: best?.total ?? 0,
    enoughData: Boolean(best && best.total >= LEVEL3_MIN_SAMPLE && best.submitted > 0),
  }
}

function createLevel3Board(
  id: string,
  title: string,
  rows: Level3BucketRow[],
  options?: { limit?: number; includeShare?: boolean; takeawayPrefix?: string },
): IntelligenceBoard {
  const limit = options?.limit ?? 6
  const includeShare = options?.includeShare === true
  const best = pickLevel3Winner(rows)

  return {
    id,
    title,
    columns: [
      { key: 'total', label: 'Total leads' },
      { key: 'submitted', label: 'Submitted leads' },
      { key: 'submissionRate', label: 'Submission rate' },
      ...(includeShare ? [{ key: 'shareOfSubmitted', label: 'Share of submitted leads' }] : []),
    ],
    rows: rows.slice(0, limit).map((row) => ({
      label: row.label,
      values: {
        total: row.total,
        submitted: row.submitted,
        submissionRate: formatPercent(row.submissionRate),
        ...(includeShare ? { shareOfSubmitted: formatPercent(row.shareOfSubmitted) } : {}),
      },
    })),
    takeaway:
      !best || best.submitted === 0
        ? 'Not enough data yet to identify a clear efficiency winner.'
        : `${options?.takeawayPrefix ?? best.label} is converting best in this range at ${formatPercent(best.submissionRate)} with ${best.submitted} submissions from ${best.total.toLocaleString()} leads.`,
  }
}

function createVolumeEfficiencyGap(rows: Level3BucketRow[]): IntelligenceWinner {
  const volumeLeader = [...rows].sort(
    (a, b) =>
      b.submitted - a.submitted ||
      b.total - a.total ||
      b.submissionRate - a.submissionRate,
  )[0]
  const efficiencyLeader = pickLevel3Winner(rows)

  if (!volumeLeader || !efficiencyLeader) {
    return {
      id: 'volume-vs-efficiency-gap',
      label: 'Largest Volume vs Best Efficiency Gap',
      value: '—',
      metricLabel: 'Gap (pp)',
      metricValue: 0,
      sampleSize: 0,
      enoughData: false,
    }
  }

  const sameLeader = volumeLeader.label === efficiencyLeader.label
  if (sameLeader) {
    return {
      id: 'volume-vs-efficiency-gap',
      label: 'Volume & Efficiency Leader',
      value: volumeLeader.label,
      metricLabel: 'Submitted leads',
      metricValue: volumeLeader.submitted,
      secondaryLabel: 'Submission rate',
      secondaryValue: `${formatPercent(volumeLeader.submissionRate)} (${volumeLeader.submitted}/${volumeLeader.total} leads)`,
      sampleSize: volumeLeader.total,
      enoughData: volumeLeader.total >= LEVEL3_MIN_SAMPLE && volumeLeader.submitted > 0,
    }
  }

  const gap = Math.max(0, round1(efficiencyLeader.submissionRate - volumeLeader.submissionRate))
  return {
    id: 'volume-vs-efficiency-gap',
    label: 'Largest Volume vs Best Efficiency Gap',
    value: `${volumeLeader.label} vs ${efficiencyLeader.label}`,
    metricLabel: 'Gap (pp)',
    metricValue: gap,
    secondaryLabel: 'Efficiency leader rate',
    secondaryValue: `${formatPercent(efficiencyLeader.submissionRate)} (${efficiencyLeader.submitted}/${efficiencyLeader.total})`,
    sampleSize: Math.max(volumeLeader.total, efficiencyLeader.total),
    enoughData:
      volumeLeader.total >= LEVEL3_MIN_SAMPLE && efficiencyLeader.total >= LEVEL3_MIN_SAMPLE,
  }
}

const LEVEL3_MAX_PAIR_BOARDS = 10

type Level3DimId = 'source' | 'time' | 'state' | 'age' | 'make' | 'gender'

type Level3Dimension = {
  id: Level3DimId
  available: boolean
  rows: Level3BucketRow[]
  read: (lead: FunnelLeadRow) => string | null
}

type Level3PairSpec = {
  left: Level3DimId
  right: Level3DimId
  winnerId: string
  winnerLabel: string
  boardId: string
  boardTitle: string
}

const LEVEL3_PAIR_SPECS: Level3PairSpec[] = [
  {
    left: 'source',
    right: 'age',
    winnerId: 'best-converting-source-age-group',
    winnerLabel: 'Best Converting Source x Age Group',
    boardId: 'source-age-performance',
    boardTitle: 'Source x Age Group',
  },
  {
    left: 'source',
    right: 'state',
    winnerId: 'best-converting-source-state',
    winnerLabel: 'Best Converting Source x State',
    boardId: 'source-state-performance',
    boardTitle: 'Source x State',
  },
  {
    left: 'source',
    right: 'make',
    winnerId: 'best-converting-source-make',
    winnerLabel: 'Best Converting Source x Vehicle Make',
    boardId: 'source-make-performance',
    boardTitle: 'Source x Vehicle Make',
  },
  {
    left: 'source',
    right: 'time',
    winnerId: 'best-converting-source-time',
    winnerLabel: 'Best Converting Source x Time Window',
    boardId: 'source-time-performance',
    boardTitle: 'Source x Time Window',
  },
  {
    left: 'source',
    right: 'gender',
    winnerId: 'best-converting-source-gender',
    winnerLabel: 'Best Converting Source x Gender',
    boardId: 'source-gender-performance',
    boardTitle: 'Source x Gender',
  },
  {
    left: 'age',
    right: 'state',
    winnerId: 'best-converting-age-state',
    winnerLabel: 'Best Converting Age Group x State',
    boardId: 'age-state-performance',
    boardTitle: 'Age Group x State',
  },
  {
    left: 'make',
    right: 'age',
    winnerId: 'best-converting-make-age',
    winnerLabel: 'Best Converting Vehicle Make x Age Group',
    boardId: 'make-age-performance',
    boardTitle: 'Vehicle Make x Age Group',
  },
  {
    left: 'make',
    right: 'state',
    winnerId: 'best-converting-make-state',
    winnerLabel: 'Best Converting Vehicle Make x State',
    boardId: 'make-state-performance',
    boardTitle: 'Vehicle Make x State',
  },
  {
    left: 'time',
    right: 'state',
    winnerId: 'best-converting-time-state',
    winnerLabel: 'Best Converting Time Window x State',
    boardId: 'time-state-performance',
    boardTitle: 'Time Window x State',
  },
  {
    left: 'time',
    right: 'age',
    winnerId: 'best-converting-time-age',
    winnerLabel: 'Best Converting Time Window x Age Group',
    boardId: 'time-age-performance',
    boardTitle: 'Time Window x Age Group',
  },
]

function findLevel3GenderFieldKey(visibleLeadFieldKeys: string[]): string | null {
  for (const key of visibleLeadFieldKeys) {
    const trimmed = key.trim()
    if (/gender|sex|^driver_\d+_gender$/i.test(trimmed)) return trimmed
  }
  return null
}

function canonicalizeLevel3Gender(raw: string): string | null {
  const value = raw.trim().toLowerCase()
  if (['male', 'm'].includes(value)) return 'Male'
  if (['female', 'f'].includes(value)) return 'Female'
  return null
}

function findLevel3MakeFieldKeys(visibleLeadFieldKeys: string[]): string[] {
  const preferred = ['car_0_make', 'vehicle_0_make']
  const fromVisible = visibleLeadFieldKeys.filter((key) =>
    /(?:^|_)(?:make|manufacturer)$/i.test(key.trim()),
  )
  return [...new Set([...preferred, ...fromVisible])]
}

function buildLevel3Dimensions(
  leads: FunnelLeadRow[],
  visibleLeadFieldKeys: string[],
): Record<Level3DimId, Level3Dimension> {
  const now = getAnalyticsEtParts(new Date())
  const genderKey = findLevel3GenderFieldKey(visibleLeadFieldKeys)
  const makeKeys = findLevel3MakeFieldKeys(visibleLeadFieldKeys)
  const canUseState = hasVisibleLeadField(visibleLeadFieldKeys, ['state'])
  const canUseAge = hasVisibleLeadField(visibleLeadFieldKeys, ['dob', 'age', 'driver_0_age'])
  const canUseMake = visibleLeadFieldKeys.some((key) =>
    /(?:^|_)(?:make|manufacturer)$/i.test(key.trim()),
  )

  const readSource = (lead: FunnelLeadRow) => normalizeLevel3Source(lead.utmSource)
  const readTime = (lead: FunnelLeadRow) => {
    const when = parseLeadWhen(lead.createdAt)
    if (!when) return null
    return formatAnalyticsHourWindow(getAnalyticsEtParts(when).hour)
  }
  const readState = (lead: FunnelLeadRow) => {
    const stateRaw = pickFieldValue(lead.fields, ['state'])
    return stateRaw ? normalizeLeadStateName(stateRaw) : null
  }
  const readAge = (lead: FunnelLeadRow) => {
    const age = resolveLeadAge(lead.fields, now)
    return age != null ? ageGroupFromAge(age) : null
  }
  const readMake = (lead: FunnelLeadRow) => {
    const make = pickFieldValue(lead.fields, makeKeys)
    return make ? normalizeVehicleMake(makeKeys[0] ?? 'car_0_make', make) : null
  }
  const readGender = (lead: FunnelLeadRow) => {
    if (!genderKey) return null
    const raw = pickFieldValue(lead.fields, [genderKey])
    return raw ? canonicalizeLevel3Gender(raw) : null
  }

  const sourceRows = rankLevel3Dimension(leads, readSource)
  const timeRows = rankLevel3Dimension(leads, readTime)
  const stateRows = canUseState ? rankLevel3Dimension(leads, readState) : []
  const ageRows = canUseAge ? rankLevel3Dimension(leads, readAge) : []
  const makeRows = canUseMake ? rankLevel3Dimension(leads, readMake) : []
  const genderRows = genderKey != null ? rankLevel3Dimension(leads, readGender) : []

  return {
    source: {
      id: 'source',
      available: sourceRows.length > 0,
      rows: sourceRows,
      read: readSource,
    },
    time: {
      id: 'time',
      available: timeRows.length > 0,
      rows: timeRows,
      read: readTime,
    },
    state: {
      id: 'state',
      available: canUseState && stateRows.length > 0,
      rows: stateRows,
      read: readState,
    },
    age: {
      id: 'age',
      available: canUseAge && ageRows.length > 0,
      rows: ageRows,
      read: readAge,
    },
    make: {
      id: 'make',
      available: canUseMake && makeRows.length > 0,
      rows: makeRows,
      read: readMake,
    },
    gender: {
      id: 'gender',
      available: genderKey != null && genderRows.length > 0,
      rows: genderRows,
      read: readGender,
    },
  }
}

function createLevel3Actions(input: {
  bestSource: IntelligenceWinner
  bestState: IntelligenceWinner | null
  bestSourceAge: IntelligenceWinner | null
  bestSourceMake: IntelligenceWinner | null
  bestSourceTime: IntelligenceWinner | null
  bestAgeState: IntelligenceWinner | null
  gap: IntelligenceWinner
}): string[] {
  const actions: string[] = []

  if (input.bestSource.enoughData && input.bestSource.value !== '—') {
    actions.push(
      `Scale spend on ${input.bestSource.value}: It is your highest-efficiency acquisition channel converting at ${input.bestSource.secondaryValue}.`,
    )
  }
  if (input.bestSourceAge?.enoughData && input.bestSourceAge.value !== '—') {
    actions.push(
      `Prioritize the ${input.bestSourceAge.value} audience: This source and age group combination delivers your top conversion performance (${input.bestSourceAge.secondaryValue}).`,
    )
  }
  if (input.bestSourceMake?.enoughData && input.bestSourceMake.value !== '—') {
    actions.push(
      `Align creative to ${input.bestSourceMake.value}: This source and vehicle make combination leads conversion efficiency (${input.bestSourceMake.secondaryValue}).`,
    )
  }
  if (input.bestSourceTime?.enoughData && input.bestSourceTime.value !== '—') {
    actions.push(
      `Schedule more budget into ${input.bestSourceTime.value}: Highest-efficiency source and daypart combination (${input.bestSourceTime.secondaryValue}).`,
    )
  }
  if (input.bestAgeState?.enoughData && input.bestAgeState.value !== '—') {
    actions.push(
      `Target ${input.bestAgeState.value}: This age group and state combination converts best (${input.bestAgeState.secondaryValue}).`,
    )
  }
  if (input.bestState?.enoughData && input.bestState.value !== '—') {
    actions.push(
      `Lean budget toward ${input.bestState.value}: Leading all geographic regions on submission efficiency (${input.bestState.secondaryValue}).`,
    )
  }
  if (input.gap.enoughData) {
    if (input.gap.label === 'Volume & Efficiency Leader') {
      actions.push(
        `${input.gap.value} captures both your largest lead volume and highest conversion efficiency — a strong signal to scale ad spend with high confidence.`,
      )
    } else if (input.gap.value.includes(' vs ')) {
      actions.push(
        `Review traffic distribution between ${input.gap.value}: The efficiency leader outperforms your top volume channel by +${input.gap.metricValue}% conversion rate.`,
      )
    }
  }

  return actions.slice(0, 4)
}

export function computeLevel3FromLeads(
  leads: FunnelLeadRow[],
  visibleLeadFieldKeys: string[],
): Level3Payload {
  if (leads.length === 0) {
    return { section: 'level3', winners: [], boards: [], actions: [] }
  }

  const dims = buildLevel3Dimensions(leads, visibleLeadFieldKeys)

  const pairResults: Array<{
    spec: Level3PairSpec
    winner: IntelligenceWinner
    board: IntelligenceBoard
  }> = []

  for (const spec of LEVEL3_PAIR_SPECS) {
    const left = dims[spec.left]
    const right = dims[spec.right]
    if (!left.available || !right.available) continue
    const rows = rankLevel3Pairs(leads, left.read, right.read)
    if (rows.length === 0) continue
    pairResults.push({
      spec,
      winner: createLevel3WinnerCard(spec.winnerId, spec.winnerLabel, rows),
      board: createLevel3Board(spec.boardId, spec.boardTitle, rows, { limit: 8 }),
    })
  }

  const cappedPairs = pairResults.slice(0, LEVEL3_MAX_PAIR_BOARDS)
  const winnerById = new Map(
    cappedPairs.map((pair) => [pair.spec.winnerId, pair.winner]),
  )

  const bestSource = createLevel3WinnerCard(
    'best-converting-source',
    'Best Converting Source',
    dims.source.rows,
  )
  const bestState = dims.state.available
    ? createLevel3WinnerCard('best-converting-state', 'Best Converting State', dims.state.rows)
    : null
  const bestAge = dims.age.available
    ? createLevel3WinnerCard(
        'best-converting-age-group',
        'Best Converting Age Group',
        dims.age.rows,
      )
    : null
  const bestMake = dims.make.available
    ? createLevel3WinnerCard(
        'best-converting-vehicle-make',
        'Best Converting Vehicle Make',
        dims.make.rows,
      )
    : null
  const bestTime = createLevel3WinnerCard(
    'most-efficient-time-window',
    'Most Efficient Time Window',
    dims.time.rows,
  )
  const gap = createVolumeEfficiencyGap(dims.source.rows)
  const pairWinners = cappedPairs.map((pair) => pair.winner)

  return {
    section: 'level3',
    winners: [
      bestSource,
      ...(bestState ? [bestState] : []),
      ...(bestAge ? [bestAge] : []),
      ...pairWinners,
      ...(bestMake ? [bestMake] : []),
      bestTime,
      gap,
    ],
    boards: [
      createLevel3Board('source-performance', 'Source Performance', dims.source.rows, {
        includeShare: true,
      }),
      ...(dims.state.available
        ? [
            createLevel3Board('state-performance', 'State Performance', dims.state.rows, {
              includeShare: true,
            }),
          ]
        : []),
      ...cappedPairs.map((pair) => pair.board),
    ],
    actions: createLevel3Actions({
      bestSource,
      bestState,
      bestSourceAge: winnerById.get('best-converting-source-age-group') ?? null,
      bestSourceMake: winnerById.get('best-converting-source-make') ?? null,
      bestSourceTime: winnerById.get('best-converting-source-time') ?? null,
      bestAgeState: winnerById.get('best-converting-age-state') ?? null,
      gap,
    }),
  }
}

export function paginateDisplayableLeads(
  leads: FunnelLeadRow[],
  limit: number,
  offset: number,
): Pick<FunnelLeadsResponse, 'leads' | 'total' | 'limit' | 'offset' | 'hasMore'> {
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit) || 15))
  let safeOffset = Math.max(0, Math.floor(offset) || 0)
  const total = leads.length

  if (total === 0) {
    return {
      leads: [],
      total: 0,
      limit: safeLimit,
      offset: 0,
      hasMore: false,
    }
  }

  const maxOffset = Math.floor((total - 1) / safeLimit) * safeLimit
  if (safeOffset > maxOffset) safeOffset = maxOffset

  const page = leads.slice(safeOffset, safeOffset + safeLimit)
  return {
    leads: page,
    total,
    limit: safeLimit,
    offset: safeOffset,
    hasMore: safeOffset + page.length < total,
  }
}

export async function getFunnelLeads({
  workspaceId,
  rangeId,
  custom,
  limit = 15,
  offset = 0,
}: {
  workspaceId: string
  rangeId: AnalyticsRangeId
  custom?: AnalyticsCustomRange
  limit?: number
  offset?: number
}): Promise<FunnelLeadsResponse> {
  const window = resolveAnalyticsWindow(rangeId, new Date(), custom)
  const ch = getClickHouseClient()
  const where = `${rangeFilter()}
    AND event_name IN ('form_success', 'form_step_complete', 'form_step_view')
    AND positionCaseInsensitive(properties, '"fields"') > 0`

  const p = {
    wid: workspaceId,
    ...rangeQueryParams(window),
    lim: MAX_RAW_SESSIONS,
    off: 0,
  }

  const rowsRes = await ch.query({
    format: 'JSON',
    query_params: p,
    query: `
      SELECT
        l.session_id AS session_id,
        f.fingerprint AS fingerprint,
        l.last_at AS last_at,
        l.submitted_at AS submitted_at,
        l.props AS props,
        l.form_submitted AS form_submitted,
        l.sample_url AS sample_url,
        z.zip_val AS zip_val,
        u.utm_source AS utm_source,
        u.utm_id AS utm_id
      FROM (
        SELECT
          session_id,
          max(created_at) AS last_at,
          maxIf(created_at, ${SUBMIT_EVENTS}) AS submitted_at,
          argMax(properties, (length(properties), created_at)) AS props,
          argMax(url, (length(properties), created_at)) AS sample_url,
          max(${SUBMIT_EVENTS}) AS form_submitted
        FROM events_raw
        WHERE ${where}
        GROUP BY session_id
      ) AS l
      LEFT JOIN (
        SELECT
          session_id,
          anyIf(fingerprint, fingerprint != '') AS fingerprint
        FROM events_raw
        WHERE ${rangeFilter()}
        GROUP BY session_id
      ) AS f ON f.session_id = l.session_id
      LEFT JOIN (
        SELECT
          session_id,
          max(nullIf(zipcode, '')) AS zip_val
        FROM events_raw
        WHERE ${rangeFilter()}
          AND zipcode != ''
        GROUP BY session_id
      ) AS z ON z.session_id = l.session_id
      LEFT JOIN (
        SELECT
          session_id,
          anyIf(utm_source, utm_source != '') AS utm_source,
          anyIf(utm_id, utm_id != '') AS utm_id
        FROM events_raw
        WHERE ${rangeFilter()}
        GROUP BY session_id
      ) AS u ON u.session_id = l.session_id
      ORDER BY last_at DESC
      LIMIT {lim:UInt32} OFFSET {off:UInt32}
    `,
  })

  const rows =
    ((await rowsRes.json()) as CHJson<RawLeadSessionRow>).data ?? []

  const normalizedLeads = rows
    .map((row) => toFunnelLead(row))
    .filter((lead) => isDisplayableLead(lead))
  let displayable = normalizedLeads
  try {
    displayable = await resolveVehicleNamesInLeads(normalizedLeads)
  } catch (error) {
    console.error('[funnel-leads] vehicle model lookup failed', error)
  }

  const level1Stats = computeLevel1StatsFromLeads(displayable)
  const level2Stats = computeLevel2StatsFromLeads(displayable)
  const visibleLeadFieldKeys = discoverVisibleLeadFieldKeys(displayable)
  const level3 = computeLevel3FromLeads(displayable, visibleLeadFieldKeys)
  const page = paginateDisplayableLeads(displayable, limit, offset)

  return {
    rangeId: window.rangeId,
    visibleLeadFieldKeys,
    level1Stats,
    level2Stats,
    level3,
    ...page,
  }
}

export function emptyFunnelLeads(
  rangeId: AnalyticsRangeId,
  limit = 15,
  offset = 0,
): FunnelLeadsResponse {
  return {
    rangeId,
    leads: [],
    visibleLeadFieldKeys: [],
    total: 0,
    limit,
    offset,
    hasMore: false,
    level1Stats: computeLevel1StatsFromLeads([]),
    level2Stats: computeLevel2StatsFromLeads([]),
    level3: computeLevel3FromLeads([], []),
  }
}
