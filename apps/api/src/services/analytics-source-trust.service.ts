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
import { evaluateUtmSourceReputation } from '../lib/lead-fraud/utm-source-reputation.js'
import { CLICKHOUSE_EVENTS_TABLE } from '../lib/clickhouse-events-table.js'
import {
  getAnalyticsClickHouseClient,
  LEAD_CONTACT_KEYS_TABLE,
  LEAD_RISK_TABLE,
} from './clickhouse.service.js'

export type LandingPageSourceTrustRow = {
  utmSource: string
  trustScore: number | null
  trustScore7d: number | null
  trustScore30d: number | null
  leadsTotal: number
  leads7d: number
  leads30d: number
  mismatchTotal: number
  mismatch7d: number
  mismatch30d: number
  mismatchRate7d: number
  mismatchRate30d: number
  reputation7d: 'clean' | 'location_mismatch_cluster' | 'unknown'
  reputation30d: 'clean' | 'location_mismatch_cluster' | 'unknown'
  reputation: 'clean' | 'location_mismatch_cluster' | 'unknown'
}

type CHJson<T> = { data: T[] }

type RawRow = {
  utm_source: string
  leads_total: string
  leads_7d: string
  leads_30d: string
  mismatch_total: string
  mismatch_7d: string
  mismatch_30d: string
  avg_trust: string | number | null
  avg_trust_7d: string | number | null
  avg_trust_30d: string | number | null
}

function n(value: string | number | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function avg(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed) : null
}

function reputationSource(label: string): string {
  const trimmed = label.trim()
  if (!trimmed || trimmed === '—' || trimmed === '(none)') return ''
  return trimmed
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
  // Segment predicates are compiled against events_raw columns.
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

export function mapSourceTrustRawRow(row: RawRow): LandingPageSourceTrustRow {
  const leadsTotal = n(row.leads_total)
  const leads7d = n(row.leads_7d)
  const leads30d = n(row.leads_30d)
  const mismatchTotal = n(row.mismatch_total)
  const mismatch7d = n(row.mismatch_7d)
  const mismatch30d = n(row.mismatch_30d)
  const utmSource =
    !row.utm_source || row.utm_source === '(none)' ? '—' : row.utm_source
  const reputation7d = evaluateUtmSourceReputation({
    source: reputationSource(utmSource),
    submitCount: leads7d,
    locationMismatchCount: mismatch7d,
  }).status
  const reputation30d = evaluateUtmSourceReputation({
    source: reputationSource(utmSource),
    submitCount: leads30d,
    locationMismatchCount: mismatch30d,
  }).status
  return {
    utmSource,
    trustScore: avg(row.avg_trust),
    trustScore7d: avg(row.avg_trust_7d),
    trustScore30d: avg(row.avg_trust_30d),
    leadsTotal,
    leads7d,
    leads30d,
    mismatchTotal,
    mismatch7d,
    mismatch30d,
    mismatchRate7d: leads7d > 0 ? mismatch7d / leads7d : 0,
    mismatchRate30d: leads30d > 0 ? mismatch30d / leads30d : 0,
    reputation7d,
    reputation30d,
    reputation: reputation30d,
  }
}

export async function getLandingPageSourceTrust(input: {
  workspaceId: string
  rangeId: AnalyticsRangeId
  custom?: AnalyticsCustomRange | null
  utmFilter?: AnalyticsUtmFilter
}): Promise<{ sources: LandingPageSourceTrustRow[] }> {
  const window = await resolveAnalyticsWindowForLanding(
    input.rangeId,
    input.workspaceId,
    new Date(),
    input.custom,
  )
  const utmKey = utmFilterCacheKey(input.utmFilter)
  const cacheKey = `analytics:source-trust:v1:${input.workspaceId}:${rangeCacheKey(window, utmKey)}`
  const cached = await readAnalyticsCache<{ sources: LandingPageSourceTrustRow[] }>(
    cacheKey,
  )
  if (cached) return cached

  const ch = getAnalyticsClickHouseClient()
  const keysUtmSql = contactKeysUtmSql(input.utmFilter)
  const segmentSql = segmentSessionFilterSql(input.utmFilter)
  const params: Record<string, unknown> = {
    wid: input.workspaceId,
    wid_str: input.workspaceId,
    ...rangeQueryParams(window),
    ...utmFilterParams(input.utmFilter),
  }

  const res = await ch.query({
    format: 'JSON',
    query_params: params,
    query: `
      WITH sessions AS (
        SELECT
          k.landing_page_id AS landing_page_id,
          k.session_id AS session_id,
          argMax(k.utm_source, k.submitted_at) AS utm_source,
          argMax(k.utm_s1, k.submitted_at) AS utm_s1,
          max(k.submitted_at) AS submitted_at
        FROM ${LEAD_CONTACT_KEYS_TABLE} AS k FINAL
        WHERE k.landing_page_id = {wid_str:String}
          AND k.submitted_at >= toDateTime64({range_from:String}, 3, 'UTC')
          AND k.submitted_at < toDateTime64({range_to:String}, 3, 'UTC')
          ${keysUtmSql}
          ${segmentSql}
        GROUP BY k.landing_page_id, k.session_id
      )
      SELECT
        multiIf(
          nullIf(s.utm_source, '') IS NOT NULL, s.utm_source,
          nullIf(s.utm_s1, '') IS NOT NULL, concat('s1:', s.utm_s1),
          '—'
        ) AS utm_source,
        uniqExact(s.session_id) AS leads_total,
        uniqExactIf(
          s.session_id,
          s.submitted_at >= now64(3, 'UTC') - INTERVAL 7 DAY
        ) AS leads_7d,
        uniqExactIf(
          s.session_id,
          s.submitted_at >= now64(3, 'UTC') - INTERVAL 30 DAY
        ) AS leads_30d,
        uniqExactIf(
          s.session_id,
          positionCaseInsensitive(coalesce(risk.findings_json, ''), 'location_inconsistency') > 0
        ) AS mismatch_total,
        uniqExactIf(
          s.session_id,
          s.submitted_at >= now64(3, 'UTC') - INTERVAL 7 DAY
            AND positionCaseInsensitive(coalesce(risk.findings_json, ''), 'location_inconsistency') > 0
        ) AS mismatch_7d,
        uniqExactIf(
          s.session_id,
          s.submitted_at >= now64(3, 'UTC') - INTERVAL 30 DAY
            AND positionCaseInsensitive(coalesce(risk.findings_json, ''), 'location_inconsistency') > 0
        ) AS mismatch_30d,
        avgIf(
          risk.score,
          risk.score IS NOT NULL AND risk.coverage != 'insufficient'
        ) AS avg_trust,
        avgIf(
          risk.score,
          risk.score IS NOT NULL
            AND risk.coverage != 'insufficient'
            AND s.submitted_at >= now64(3, 'UTC') - INTERVAL 7 DAY
        ) AS avg_trust_7d,
        avgIf(
          risk.score,
          risk.score IS NOT NULL
            AND risk.coverage != 'insufficient'
            AND s.submitted_at >= now64(3, 'UTC') - INTERVAL 30 DAY
        ) AS avg_trust_30d
      FROM sessions AS s
      LEFT JOIN ${LEAD_RISK_TABLE} AS risk FINAL
        ON s.landing_page_id = toString(risk.workspace_id)
        AND s.session_id = risk.session_id
      GROUP BY utm_source
      HAVING leads_total >= 1
      ORDER BY leads_30d DESC, leads_total DESC
      LIMIT 200
    `,
  })

  const rows = ((await res.json()) as CHJson<RawRow>).data ?? []
  const payload = { sources: rows.map(mapSourceTrustRawRow) }
  await writeAnalyticsCache(cacheKey, payload, ANALYTICS_CACHE_TTL_SEC)
  return payload
}
