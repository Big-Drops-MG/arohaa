import { getClickHouseClient } from './clickhouse.service.js'
import {
  rangeFilter,
  rangeQueryParams,
  resolveAnalyticsWindow,
  type AnalyticsCustomRange,
  type AnalyticsRangeId,
} from '../lib/analytics-range.js'
import {
  fieldsWithoutReserved,
  isDisplayableLead,
  normalizeLeadFields,
  pickLeadEmail,
  pickLeadZip,
  pickTrustedFormUrl,
} from '../lib/lead-fields.js'

type CHJson<T> = { data: T[] }

export type FunnelLeadRow = {
  sessionId: string
  createdAt: string
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
}

type RawLeadSessionRow = {
  session_id: string
  last_at: string
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
  return {
    sessionId: row.session_id,
    createdAt: row.last_at,
    zip,
    email,
    utmSource: utm.utmSource,
    utmId: utm.utmId,
    trustedFormUrl: pickTrustedFormUrl(rawFields),
    formSubmitted:
      row.form_submitted === true ||
      row.form_submitted === 1 ||
      row.form_submitted === '1',
    fields: fieldsWithoutReserved(fields),
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
        l.last_at AS last_at,
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
          argMax(properties, (length(properties), created_at)) AS props,
          argMax(url, (length(properties), created_at)) AS sample_url,
          max(event_name = 'form_success') AS form_submitted
        FROM events_raw
        WHERE ${where}
        GROUP BY session_id
      ) AS l
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

  const page = paginateDisplayableLeads(displayable, limit, offset)

  return {
    rangeId: window.rangeId,
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
  }
}
