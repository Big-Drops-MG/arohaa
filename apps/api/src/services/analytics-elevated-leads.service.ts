import {
  normalizeAnalyticsUtmFilter,
  utmFilterCacheKey,
  utmFilterParams,
  type AnalyticsUtmFilter,
} from '../lib/analytics-utm-filter.js'
import {
  ANALYTICS_CACHE_TTL_SEC,
  readAnalyticsCache,
  writeAnalyticsCache,
} from '../lib/analytics-cache.js'
import {
  rangeCacheKey,
  rangeQueryParams,
  resolveAnalyticsWindowForLanding,
  type AnalyticsCustomRange,
  type AnalyticsRangeId,
} from '../lib/analytics-range.js'
import { CLICKHOUSE_EVENTS_TABLE } from '../lib/clickhouse-events-table.js'
import {
  fieldsWithoutReserved,
  isDisplayableLead,
  normalizeLeadFields,
  pickLeadEmail,
  pickLeadZip,
  pickTrustedFormUrl,
} from '../lib/lead-fields.js'
import { extractRawFieldMap } from '../lib/lead-fraud/field-signals.js'
import { loadBehaviorSummaryBySessions } from '../lib/lead-fraud/behavior-summary-batch.js'
import type { LeadFraudAssessment } from '../lib/lead-fraud/types.js'
import {
  assessmentFromRiskRow,
  fetchLeadRiskRows,
} from '../lib/lead-fraud/persist.js'
import {
  getAnalyticsClickHouseClient,
  LEAD_CONTACT_KEYS_TABLE,
  LEAD_RISK_TABLE,
} from './clickhouse.service.js'
import type { FunnelLeadRow } from './analytics-funnel-leads.service.js'

function formatFingerprintAsMacId(fingerprint: string): string {
  const raw = fingerprint.trim()
  if (!raw) return ''
  if (raw.length <= 16) return raw
  return `${raw.slice(0, 8)}…${raw.slice(-4)}`
}

type CHJson<T> = { data: T[] }

const SUBMIT_EVENTS = `event_name IN ('form_success', 'service_click')`
const SEED_EVENTS = `(
  event_name IN ('form_success', 'form_step_complete', 'form_step_view')
  AND (
    positionCaseInsensitive(properties, '"fields"') > 0
    OR positionCaseInsensitive(properties, '"_k"') > 0
  )
)`

const ELEVATED_RISK_SQL = `
  if(
    r.override_label IN ('fraud', 'legit'),
    r.override_label,
    r.label
  ) = 'fraud'
  AND (r.coverage = '' OR r.coverage != 'insufficient')
`

export type ElevatedLeadsResponse = {
  rangeId: AnalyticsRangeId
  leads: FunnelLeadRow[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
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
  client_ip: string
  utm_source: string
  utm_id: string
  utm_s1: string
}

function contactKeysUtmSql(filter?: AnalyticsUtmFilter): string {
  const normalized = normalizeAnalyticsUtmFilter({
    utm_source: filter?.utm_source,
    utm_s1: filter?.utm_s1,
  })
  if (!normalized) return ''
  const parts: string[] = []
  if (normalized.utm_source?.length) {
    parts.push('k.utm_source IN {utm_sources:Array(String)}')
  }
  if (normalized.utm_s1?.length) {
    parts.push('k.utm_s1 IN {utm_s1s:Array(String)}')
  }
  return parts.length ? ` AND ${parts.join(' AND ')}` : ''
}

function segmentSessionFilterSql(filter?: AnalyticsUtmFilter): string {
  if (!filter?.segmentSql) return ''
  return `
    AND k.session_id IN (
      SELECT session_id
      FROM ${CLICKHOUSE_EVENTS_TABLE}
      WHERE workspace_id = {wid:UUID}
        AND created_at >= toDateTime64({range_from:String}, 3, 'UTC')
        AND created_at < toDateTime64({range_to:String}, 3, 'UTC')
        AND (${filter.segmentSql})
      GROUP BY session_id
    )`
}

function pickQueryParam(url: string, keys: string[]): string {
  try {
    const parsed = new URL(url, 'https://example.invalid')
    for (const key of keys) {
      const value = parsed.searchParams.get(key)?.trim()
      if (value) return value.slice(0, 200)
    }
  } catch {
    /* ignore */
  }
  return ''
}

function resolveLeadUtm(input: {
  utmSource?: string
  utmId?: string
  utmS1?: string
  url?: string
  fields?: Record<string, string>
}): { utmSource: string; utmId: string; utmS1: string } {
  const url = input.url || ''
  const fields = input.fields ?? {}
  const fieldValue = (...keys: string[]) => {
    for (const key of keys) {
      const direct = (fields[key] || '').trim()
      if (direct) return direct.slice(0, 200)
      const lower = (fields[key.toLowerCase()] || '').trim()
      if (lower) return lower.slice(0, 200)
    }
    return ''
  }
  return {
    utmSource:
      (input.utmSource || '').trim() ||
      fieldValue('utm_source', 'utmsource', 'sid', 'source') ||
      pickQueryParam(url, ['utm_source', 'sid', 'source']),
    utmId:
      (input.utmId || '').trim() ||
      fieldValue('utm_id', 'utmid', 'tid', 'uid') ||
      pickQueryParam(url, ['utm_id', 'tid', 'uid']),
    utmS1:
      (input.utmS1 || '').trim() ||
      fieldValue('utm_s1', 'utms1', 's1') ||
      pickQueryParam(url, ['utm_s1', 's1']),
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

function unavailableFraud(): LeadFraudAssessment {
  return {
    score: null,
    scoreAvailable: false,
    label: 'fraud',
    effectiveLabel: 'fraud',
    coverage: 'insufficient',
    findings: [],
    reasons: [],
    modelVersion: '',
  }
}

export function toElevatedFunnelLead(row: RawLeadSessionRow): FunnelLeadRow {
  const rawFields = extractRawFieldMap(row.props || '{}')
  const fields = normalizeLeadFields(rawFields)
  const email = pickLeadEmail(fields)
  const zip = row.zip_val || pickLeadZip(fields) || ''
  const utm = resolveLeadUtm({
    utmSource: row.utm_source,
    utmId: row.utm_id,
    utmS1: row.utm_s1,
    url: row.sample_url,
    fields: rawFields,
  })
  const submittedAt = isValidLeadTimestamp(row.submitted_at)
    ? row.submitted_at.trim()
    : null
  return {
    sessionId: row.session_id,
    macId: formatFingerprintAsMacId(row.fingerprint || ''),
    createdAt: row.last_at,
    submittedAt,
    zip,
    clientIp: String(row.client_ip || '').trim().slice(0, 45),
    email,
    utmSource: utm.utmSource,
    utmId: utm.utmId,
    utmS1: utm.utmS1,
    trustedFormUrl: pickTrustedFormUrl(rawFields),
    formSubmitted: isLeadFormSubmitted(row.form_submitted),
    returnCount: 0,
    fields: fieldsWithoutReserved(fields),
    fraud: unavailableFraud(),
    behavior: null,
  }
}

export function isElevatedRiskAssessment(
  fraud: LeadFraudAssessment | null | undefined,
): boolean {
  return Boolean(
    fraud?.scoreAvailable &&
      (fraud.effectiveLabel === 'fraud' || fraud.label === 'fraud'),
  )
}

async function listElevatedSessionPage(input: {
  workspaceId: string
  rangeFrom: string
  rangeTo: string
  utmFilter?: AnalyticsUtmFilter
  limit: number
  offset: number
}): Promise<{ sessionIds: string[]; total: number }> {
  const ch = getAnalyticsClickHouseClient()
  const keysUtmSql = contactKeysUtmSql(input.utmFilter)
  const segmentSql = segmentSessionFilterSql(input.utmFilter)
  const params: Record<string, unknown> = {
    wid: input.workspaceId,
    wid_str: input.workspaceId,
    range_from: input.rangeFrom,
    range_to: input.rangeTo,
    lim: input.limit,
    off: input.offset,
    ...utmFilterParams(input.utmFilter),
  }

  const sessionsCte = `
    WITH sessions AS (
      SELECT
        k.landing_page_id AS landing_page_id,
        k.session_id AS session_id,
        max(k.submitted_at) AS submitted_at
      FROM ${LEAD_CONTACT_KEYS_TABLE} AS k FINAL
      WHERE k.landing_page_id = {wid_str:String}
        AND k.submitted_at >= toDateTime64({range_from:String}, 3, 'UTC')
        AND k.submitted_at < toDateTime64({range_to:String}, 3, 'UTC')
        ${keysUtmSql}
        ${segmentSql}
      GROUP BY k.landing_page_id, k.session_id
    )
  `

  const [pageRes, countRes] = await Promise.all([
    ch.query({
      format: 'JSON',
      query_params: params,
      query: `
        ${sessionsCte}
        SELECT s.session_id AS session_id
        FROM sessions AS s
        INNER JOIN ${LEAD_RISK_TABLE} AS r FINAL
          ON s.landing_page_id = toString(r.workspace_id)
          AND s.session_id = r.session_id
        WHERE ${ELEVATED_RISK_SQL}
        ORDER BY s.submitted_at DESC
        LIMIT {lim:UInt32} OFFSET {off:UInt32}
      `,
    }),
    ch.query({
      format: 'JSON',
      query_params: params,
      query: `
        ${sessionsCte}
        SELECT count() AS total
        FROM sessions AS s
        INNER JOIN ${LEAD_RISK_TABLE} AS r FINAL
          ON s.landing_page_id = toString(r.workspace_id)
          AND s.session_id = r.session_id
        WHERE ${ELEVATED_RISK_SQL}
      `,
    }),
  ])

  const pageRows =
    ((await pageRes.json()) as CHJson<{ session_id: string }>).data ?? []
  const totalRows =
    ((await countRes.json()) as CHJson<{ total: string }>).data ?? []
  const total = Number(totalRows[0]?.total ?? 0)
  return {
    sessionIds: pageRows
      .map((row) => String(row.session_id || '').trim())
      .filter(Boolean),
    total: Number.isFinite(total) ? total : 0,
  }
}

async function loadLeadRowsForSessions(input: {
  workspaceId: string
  sessionIds: string[]
  rangeFrom: string
  rangeTo: string
}): Promise<RawLeadSessionRow[]> {
  if (input.sessionIds.length === 0) return []
  const ch = getAnalyticsClickHouseClient()
  const params = {
    wid: input.workspaceId,
    sids: input.sessionIds,
    range_from: input.rangeFrom,
    range_to: input.rangeTo,
  }
  const query = `
    SELECT
      l.session_id AS session_id,
      f.fingerprint AS fingerprint,
      l.last_at AS last_at,
      l.submitted_at AS submitted_at,
      l.props AS props,
      l.form_submitted AS form_submitted,
      l.sample_url AS sample_url,
      z.zip_val AS zip_val,
      ip.client_ip AS client_ip,
      u.utm_source AS utm_source,
      u.utm_id AS utm_id,
      u.utm_s1 AS utm_s1
    FROM (
      SELECT
        session_id,
        max(created_at) AS last_at,
        maxIf(created_at, ${SUBMIT_EVENTS}) AS submitted_at,
        argMax(properties, (length(properties), created_at)) AS props,
        argMax(url, (length(properties), created_at)) AS sample_url,
        max(${SUBMIT_EVENTS}) AS form_submitted
      FROM ${CLICKHOUSE_EVENTS_TABLE}
      WHERE workspace_id = {wid:UUID}
        AND session_id IN {sids:Array(String)}
        AND ${SEED_EVENTS}
      GROUP BY session_id
    ) AS l
    LEFT JOIN (
      SELECT
        session_id,
        anyIf(fingerprint, fingerprint != '') AS fingerprint
      FROM ${CLICKHOUSE_EVENTS_TABLE}
      WHERE workspace_id = {wid:UUID}
        AND session_id IN {sids:Array(String)}
      GROUP BY session_id
    ) AS f ON f.session_id = l.session_id
    LEFT JOIN (
      SELECT
        session_id,
        max(
          nullIf(
            if(
              zipcode != '',
              zipcode,
              nullIf(JSONExtractString(properties, 'zip'), '')
            ),
            ''
          )
        ) AS zip_val
      FROM ${CLICKHOUSE_EVENTS_TABLE}
      WHERE workspace_id = {wid:UUID}
        AND session_id IN {sids:Array(String)}
      GROUP BY session_id
    ) AS z ON z.session_id = l.session_id
    LEFT JOIN (
      SELECT
        session_id,
        anyIf(client_ip, client_ip != '') AS client_ip
      FROM ${CLICKHOUSE_EVENTS_TABLE}
      WHERE workspace_id = {wid:UUID}
        AND session_id IN {sids:Array(String)}
      GROUP BY session_id
    ) AS ip ON ip.session_id = l.session_id
    LEFT JOIN (
      SELECT
        session_id,
        anyIf(utm_source, utm_source != '') AS utm_source,
        anyIf(utm_id, utm_id != '') AS utm_id,
        anyIf(utm_s1, utm_s1 != '') AS utm_s1
      FROM ${CLICKHOUSE_EVENTS_TABLE}
      WHERE workspace_id = {wid:UUID}
        AND session_id IN {sids:Array(String)}
      GROUP BY session_id
    ) AS u ON u.session_id = l.session_id
  `

  try {
    const res = await ch.query({
      format: 'JSON',
      query_params: params,
      query,
    })
    return ((await res.json()) as CHJson<RawLeadSessionRow>).data ?? []
  } catch (error) {
    console.error('[elevated-leads] session detail query failed', error)
    return []
  }
}

export async function getElevatedRiskLeads(input: {
  workspaceId: string
  rangeId: AnalyticsRangeId
  custom?: AnalyticsCustomRange | null
  utmFilter?: AnalyticsUtmFilter
  limit?: number
  offset?: number
}): Promise<ElevatedLeadsResponse> {
  const limit = Math.max(1, Math.min(100, Math.floor(input.limit ?? 50)))
  const offset = Math.max(0, Math.floor(input.offset ?? 0))
  const window = await resolveAnalyticsWindowForLanding(
    input.rangeId,
    input.workspaceId,
    new Date(),
    input.custom,
  )
  const rangeParams = rangeQueryParams(window)
  const utmKey = utmFilterCacheKey(input.utmFilter)
  const cacheKey = `analytics:elevated-leads:v1:${input.workspaceId}:${rangeCacheKey(window, utmKey)}:${limit}:${offset}`
  const cached = await readAnalyticsCache<ElevatedLeadsResponse>(cacheKey)
  if (cached) return cached

  const { sessionIds, total } = await listElevatedSessionPage({
    workspaceId: input.workspaceId,
    rangeFrom: rangeParams.range_from,
    rangeTo: rangeParams.range_to,
    utmFilter: input.utmFilter,
    limit,
    offset,
  })

  if (sessionIds.length === 0) {
    const empty: ElevatedLeadsResponse = {
      rangeId: window.rangeId,
      leads: [],
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    }
    await writeAnalyticsCache(cacheKey, empty, ANALYTICS_CACHE_TTL_SEC)
    return empty
  }

  const [rawRows, riskMap, behaviorMap] = await Promise.all([
    loadLeadRowsForSessions({
      workspaceId: input.workspaceId,
      sessionIds,
      rangeFrom: rangeParams.range_from,
      rangeTo: rangeParams.range_to,
    }),
    fetchLeadRiskRows(input.workspaceId, sessionIds),
    loadBehaviorSummaryBySessions({
      workspaceId: input.workspaceId,
      sessionIds,
      window: {
        rangeFrom: rangeParams.range_from,
        rangeTo: rangeParams.range_to,
      },
    }).catch(() => new Map()),
  ])

  const bySession = new Map(
    rawRows.map((row) => [String(row.session_id || '').trim(), row]),
  )
  const leads: FunnelLeadRow[] = []
  for (const sessionId of sessionIds) {
    const raw = bySession.get(sessionId)
    if (!raw) continue
    const lead = toElevatedFunnelLead(raw)
    if (!isDisplayableLead(lead)) continue
    const assessment = assessmentFromRiskRow(riskMap.get(sessionId))
    const fraud = assessment ?? unavailableFraud()
    if (!isElevatedRiskAssessment(fraud)) continue
    leads.push({
      ...lead,
      fraud,
      behavior: behaviorMap.get(sessionId) ?? null,
    })
  }

  const payload: ElevatedLeadsResponse = {
    rangeId: window.rangeId,
    leads,
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  }
  await writeAnalyticsCache(cacheKey, payload, ANALYTICS_CACHE_TTL_SEC)
  return payload
}
