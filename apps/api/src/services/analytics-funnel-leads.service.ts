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
import type { Level1Stat } from '../types/analytics-insights.js'

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

export function computeLevel1StatsFromLeads(leads: FunnelLeadRow[]): Level1Stat[] {
  const hourCounts = new Map<number, number>()

  for (const lead of leads) {
    if (!lead.formSubmitted) continue
    const when = parseLeadWhen(lead.createdAt)
    if (!when) continue
    const hour = getAnalyticsEtParts(when).hour
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1)
  }

  let bestHour = -1
  let bestCount = 0
  for (const [hour, count] of hourCounts) {
    if (count > bestCount) {
      bestHour = hour
      bestCount = count
    }
  }

  return [
    {
      id: 'best-time',
      label: 'Best Time',
      value:
        bestCount > 0 && bestHour >= 0
          ? formatAnalyticsHourWindow(bestHour)
          : '—',
      metricLabel: 'Form submissions',
      metricValue: bestCount,
      enoughData: bestCount > 0,
    },
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

  const displayable = rows
    .map((row) => toFunnelLead(row))
    .filter((lead) => isDisplayableLead(lead))

  const level1Stats = computeLevel1StatsFromLeads(displayable)
  const page = paginateDisplayableLeads(displayable, limit, offset)

  return {
    rangeId: window.rangeId,
    level1Stats,
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
  }
}
