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
import type { Level1Stat, Level2Stat } from '../types/analytics-insights.js'
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
  total: number
  limit: number
  offset: number
  hasMore: boolean
  level1Stats: Level1Stat[]
  level2Stats: Level2Stat[]
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

  const countsByColumn = new Map<string, Map<string, number>>()
  for (const key of columnKeys) countsByColumn.set(key, new Map())

  for (const lead of leads) {
    if (!lead.formSubmitted) continue
    for (const key of columnKeys) {
      const value = readLeadLevel2Value(lead, key)
      if (!value) continue
      const counts = countsByColumn.get(key)!
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }

  return columnKeys.map((key) => {
    const counts = countsByColumn.get(key) ?? new Map()
    const ratioKind = level2RatioKindForValues(counts.keys())
    if (ratioKind) return level2RatioStat(key, counts, ratioKind)
    const best = pickBestCountKey(counts)
    return {
      id: level2StatId(key),
      label: `Best ${humanizeLevel2ColumnLabel(key)}`,
      value: best.count > 0 && best.key ? best.key : '—',
      metricLabel: 'Form submissions',
      metricValue: best.count,
      enoughData: best.count > 0,
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

function pickBestCountKey<T>(counts: Map<T, number>): {
  key: T | null
  count: number
} {
  let bestKey: T | null = null
  let bestCount = 0
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestKey = key
      bestCount = count
    }
  }
  return { key: bestKey, count: bestCount }
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

function bestSubmissionStat(
  id: string,
  label: string,
  best: { key: string | null; count: number },
): Level1Stat {
  return {
    id,
    label,
    value: best.count > 0 && best.key ? best.key : '—',
    metricLabel: 'Form submissions',
    metricValue: best.count,
    enoughData: best.count > 0,
  }
}

export function computeLevel1StatsFromLeads(leads: FunnelLeadRow[]): Level1Stat[] {
  const hourCounts = new Map<number, number>()
  const zipCounts = new Map<string, number>()
  const ageGroupCounts = new Map<string, number>()
  const cityCounts = new Map<string, number>()
  const stateCounts = new Map<string, number>()
  let yesCount = 0
  let noCount = 0
  const now = getAnalyticsEtParts(new Date())

  for (const lead of leads) {
    if (lead.formSubmitted) yesCount += 1
    else noCount += 1

    if (!lead.formSubmitted) continue

    const when = parseLeadWhen(lead.createdAt)
    if (when) {
      const hour = getAnalyticsEtParts(when).hour
      hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1)
    }

    const zip = normalizeLeadZip(lead.zip)
    if (zip) {
      zipCounts.set(zip, (zipCounts.get(zip) ?? 0) + 1)
    }

    const age = resolveLeadAge(lead.fields, now)
    const ageGroup = age != null ? ageGroupFromAge(age) : null
    if (ageGroup) {
      ageGroupCounts.set(ageGroup, (ageGroupCounts.get(ageGroup) ?? 0) + 1)
    }

    const city = pickFieldValue(lead.fields, ['city'])
    if (city) {
      cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1)
    }

    const stateRaw = pickFieldValue(lead.fields, ['state'])
    const state = stateRaw ? normalizeLeadStateName(stateRaw) : null
    if (state) {
      stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1)
    }
  }

  const bestTime = pickBestCountKey(hourCounts)
  const bestZip = pickBestCountKey(zipCounts)
  const bestAgeGroup = pickBestCountKey(ageGroupCounts)
  const bestCity = pickBestCountKey(cityCounts)
  const bestState = pickBestCountKey(stateCounts)
  const totalLeads = yesCount + noCount

  return [
    {
      id: 'best-time',
      label: 'Best Time',
      value:
        bestTime.count > 0 && bestTime.key != null
          ? formatAnalyticsHourWindow(bestTime.key)
          : '—',
      metricLabel: 'Form submissions',
      metricValue: bestTime.count,
      enoughData: bestTime.count > 0,
    },
    bestSubmissionStat('best-zip', 'Best ZIP', {
      key: bestZip.key,
      count: bestZip.count,
    }),
    {
      id: 'form-submission-ratio',
      label: 'Form Submission Ratio (Yes : No)',
      value: totalLeads > 0 ? formatYesNoRatio(yesCount, noCount) : '—',
      breakdown: [
        { label: 'Yes', value: yesCount },
        { label: 'No', value: noCount },
      ],
      enoughData: totalLeads > 0,
    },
    bestSubmissionStat('best-age-group', 'Best Age Group', {
      key: bestAgeGroup.key,
      count: bestAgeGroup.count,
    }),
    bestSubmissionStat('best-city', 'Best City', {
      key: bestCity.key,
      count: bestCity.count,
    }),
    bestSubmissionStat('best-state', 'Best State', {
      key: bestState.key,
      count: bestState.count,
    }),
  ]
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
  const page = paginateDisplayableLeads(displayable, limit, offset)

  return {
    rangeId: window.rangeId,
    level1Stats,
    level2Stats,
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
    total: 0,
    limit,
    offset,
    hasMore: false,
    level1Stats: computeLevel1StatsFromLeads([]),
    level2Stats: computeLevel2StatsFromLeads([]),
  }
}
