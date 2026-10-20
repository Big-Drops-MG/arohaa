import { CLICKHOUSE_EVENTS_TABLE } from '../clickhouse-events-table.js'
import { getClickHouseClient } from '../../services/clickhouse.service.js'
import { usStateCodeFromNameOrCode } from '../us-states.js'
import {
  isTruthyFlag,
  type LeadSessionSignalRow,
} from './field-signals.js'

type CHJson<T> = { data: T[] }

type RawSignalRow = {
  workspace_id: string
  session_id: string
  fingerprint: string
  browser: string
  geo_zip: string
  geo_state: string
  geo_state_name?: string
  geo_country: string
  geo_country_code: string
  geo_city: string
  client_ip: string
  client_ip_hash: string
  form_submitted: number | boolean | string
  props: string
  zip_val: string
  submitted_at: string
  tenant_workspace_id?: string
  phone_hash?: string
  email_hash?: string
  event_id?: string
  utm_source?: string
  first_utm_source?: string
  utm_s1?: string
  utm_campaign?: string
  network_class?: string
  network_asn?: string | number
  network_org?: string
  network_evidence_source?: string
  network_evidence_as_of?: string
}

function parseSubmittedAtMs(raw: string): number {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return 0
  const normalized = trimmed.includes('T')
    ? trimmed
    : trimmed.replace(' ', 'T') + (trimmed.includes('Z') ? '' : 'Z')
  const ms = Date.parse(normalized)
  return Number.isFinite(ms) ? ms : 0
}

function mapRow(row: RawSignalRow): LeadSessionSignalRow | null {
  const workspaceId = String(row.workspace_id || '').trim()
  const sessionId = String(row.session_id || '').trim()
  if (!workspaceId || !sessionId) return null
  return {
    workspaceId,
    sessionId,
    fingerprint: String(row.fingerprint || ''),
    browser: String(row.browser || ''),
    geoZip: String(row.geo_zip || ''),
    geoState:
      String(row.geo_state || '').trim().toUpperCase() ||
      usStateCodeFromNameOrCode(String(row.geo_state_name || '')),
    geoCountry: String(row.geo_country || ''),
    geoCountryCode: String(row.geo_country_code || ''),
    geoCity: String(row.geo_city || ''),
    clientIp: String(row.client_ip || '').trim(),
    clientIpHash: String(row.client_ip_hash || ''),
    formSubmitted: isTruthyFlag(row.form_submitted),
    props: String(row.props || '{}'),
    zipVal: String(row.zip_val || ''),
    submittedAtMs: parseSubmittedAtMs(row.submitted_at),
    tenantWorkspaceId: String(row.tenant_workspace_id || '').trim() || undefined,
    phoneHash: String(row.phone_hash || '').trim() || undefined,
    emailHash: String(row.email_hash || '').trim() || undefined,
    eventId: String(row.event_id || '').trim() || undefined,
    utmSource: String(row.utm_source || '').trim() || undefined,
    firstObservedUtmSource:
      String(row.first_utm_source || row.utm_source || '').trim() || undefined,
    utmS1: String(row.utm_s1 || '').trim() || undefined,
    utmCampaign: String(row.utm_campaign || '').trim() || undefined,
    networkClass: String(row.network_class || '').trim() || undefined,
    networkAsn: Number(row.network_asn) || undefined,
    networkOrg: String(row.network_org || '').trim() || undefined,
    networkEvidenceSource:
      String(row.network_evidence_source || '').trim() || undefined,
    networkEvidenceAsOf:
      String(row.network_evidence_as_of || '').trim() || undefined,
  }
}

const LEAD_SESSION_WHERE = `
  e.session_id != ''
  AND (
    e.event_name IN ('form_submit', 'form_success')
    OR positionCaseInsensitive(e.properties, '"_k"') > 0
    OR positionCaseInsensitive(e.properties, '"fields"') > 0
  )
`

const LEAD_PROPS_EXPR = `
  coalesce(
    nullIf(
      argMaxIf(
        e.properties,
        (length(e.properties), e.created_at),
        e.event_name IN ('form_submit', 'form_success', 'form_step_complete')
      ),
      ''
    ),
    nullIf(
      argMaxIf(
        e.properties,
        (length(e.properties), e.created_at),
        e.event_name != '_fi'
          AND (
            positionCaseInsensitive(e.properties, '"_k"') > 0
            OR positionCaseInsensitive(e.properties, '"fields"') > 0
          )
      ),
      ''
    ),
    ''
  )
`

const ANY_PROPS_EXPR = `argMax(e.properties, (length(e.properties), e.created_at))`

const LEAD_SESSION_SELECT_CORE = `
  toString(e.workspace_id) AS workspace_id,
  e.session_id AS session_id,
  anyIf(e.fingerprint, e.fingerprint != '') AS fingerprint,
  anyIf(e.browser, e.browser != '') AS browser,
  anyIf(e.country, e.country != '') AS geo_country,
  anyIf(e.state, e.state != '') AS geo_state_name,
  anyIf(e.city, e.city != '') AS geo_city,
  anyIf(e.client_ip_hash, e.client_ip_hash != '') AS client_ip_hash,
  max(e.event_name IN ('form_submit', 'form_success', 'service_click')) AS form_submitted,
  toString(max(e.created_at)) AS submitted_at
`

const LEAD_SESSION_SELECT_FULL_EXTRAS = `
  max(nullIf(e.geo_zipcode, '')) AS geo_zip,
  anyIf(e.state_code, e.state_code != '') AS geo_state,
  anyIf(e.country_code, e.country_code != '') AS geo_country_code,
  anyIf(e.client_ip, e.client_ip != '') AS client_ip,
  coalesce(
    nullIf(max(e.form_zip_entered), ''),
    nullIf(max(e.zipcode), '')
  ) AS zip_val,
  anyIf(e.tenant_workspace_id, e.tenant_workspace_id != '') AS tenant_workspace_id,
  anyIf(e.phone_hash, e.phone_hash != '') AS phone_hash,
  anyIf(e.email_hash, e.email_hash != '') AS email_hash,
  anyIf(e.event_id, e.event_id != '') AS event_id,
  anyIf(e.utm_source, e.utm_source != '') AS utm_source,
  nullIf(
    argMinIf(e.utm_source, e.created_at, e.utm_source != ''),
    ''
  ) AS first_utm_source,
  anyIf(e.utm_s1, e.utm_s1 != '') AS utm_s1,
  anyIf(e.utm_campaign, e.utm_campaign != '') AS utm_campaign,
  anyIf(e.network_class, e.network_class != '') AS network_class,
  anyIf(e.network_asn, e.network_asn > 0) AS network_asn,
  anyIf(e.network_org, e.network_org != '') AS network_org,
  anyIf(e.network_evidence_source, e.network_evidence_source != '') AS network_evidence_source,
  anyIf(e.network_evidence_as_of, e.network_evidence_as_of != '') AS network_evidence_as_of
`

const LEAD_SESSION_SELECT_BASE_EXTRAS = `
  max(nullIf(e.geo_zipcode, '')) AS geo_zip,
  anyIf(e.state_code, e.state_code != '') AS geo_state,
  '' AS geo_country_code,
  '' AS client_ip,
  max(nullIf(e.zipcode, '')) AS zip_val,
  anyIf(e.tenant_workspace_id, e.tenant_workspace_id != '') AS tenant_workspace_id,
  anyIf(e.phone_hash, e.phone_hash != '') AS phone_hash,
  anyIf(e.email_hash, e.email_hash != '') AS email_hash
`

const LEAD_SESSION_SELECT_MINIMAL_EXTRAS = `
  '' AS geo_zip,
  '' AS geo_state,
  '' AS geo_country_code,
  '' AS client_ip,
  max(nullIf(e.zipcode, '')) AS zip_val
`

const LEAD_SESSION_SELECT = `
  ${LEAD_SESSION_SELECT_CORE},
  ${LEAD_PROPS_EXPR} AS props,
  ${LEAD_SESSION_SELECT_FULL_EXTRAS}
`

const LEAD_SESSION_SELECT_BASE = `
  ${LEAD_SESSION_SELECT_CORE},
  ${LEAD_PROPS_EXPR} AS props,
  ${LEAD_SESSION_SELECT_BASE_EXTRAS}
`

const LEAD_SESSION_SELECT_MINIMAL = `
  ${LEAD_SESSION_SELECT_CORE},
  ${LEAD_PROPS_EXPR} AS props,
  ${LEAD_SESSION_SELECT_MINIMAL_EXTRAS}
`

const SESSION_CONTEXT_SELECTS = [
  `
  ${LEAD_SESSION_SELECT_CORE},
  ${ANY_PROPS_EXPR} AS props,
  ${LEAD_SESSION_SELECT_FULL_EXTRAS}
`,
  `
  ${LEAD_SESSION_SELECT_CORE},
  ${ANY_PROPS_EXPR} AS props,
  ${LEAD_SESSION_SELECT_BASE_EXTRAS}
`,
  `
  ${LEAD_SESSION_SELECT_CORE},
  ${ANY_PROPS_EXPR} AS props,
  ${LEAD_SESSION_SELECT_MINIMAL_EXTRAS}
`,
]

async function queryLeadSessions(
  selectSql: string,
  whereClause: string,
  whereExtra: string,
  query_params: Record<string, unknown>,
  limit = 100_000,
  orderBySql = '',
): Promise<LeadSessionSignalRow[]> {
  const safeLimit = Math.max(1, Math.min(100_000, Math.floor(limit)))
  const ch = getClickHouseClient()
  const res = await ch.query({
    format: 'JSON',
    query_params,
    query: `
      SELECT
        ${selectSql}
      FROM ${CLICKHOUSE_EVENTS_TABLE} AS e
      WHERE ${whereClause}
        ${whereExtra}
      GROUP BY e.workspace_id, e.session_id
      ${orderBySql}
      LIMIT ${safeLimit}
    `,
  })
  const rows = ((await res.json()) as CHJson<RawSignalRow>).data ?? []
  const out: LeadSessionSignalRow[] = []
  for (const row of rows) {
    const mapped = mapRow(row)
    if (mapped) out.push(mapped)
  }
  return out
}

/**
 * Session-wide IP lookup (any event including `_fi`), same idea as loading
 * `_fi` behavior separately from lead field rows.
 */
export async function loadClientIpBySessions(
  sessions: Array<{ workspaceId: string; sessionId: string }>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const byWorkspace = new Map<string, string[]>()
  for (const s of sessions) {
    const wid = s.workspaceId.trim()
    const sid = s.sessionId.trim()
    if (!wid || !sid) continue
    const list = byWorkspace.get(wid) ?? []
    list.push(sid)
    byWorkspace.set(wid, list)
  }
  if (byWorkspace.size === 0) return out

  const ch = getClickHouseClient()
  for (const [wid, sids] of byWorkspace) {
    const uniqueSids = [...new Set(sids)]
    for (let i = 0; i < uniqueSids.length; i += 400) {
      const chunk = uniqueSids.slice(i, i + 400)
      try {
        const res = await ch.query({
          format: 'JSON',
          query_params: { wid, sids: chunk },
          query: `
            SELECT
              toString(e.workspace_id) AS workspace_id,
              e.session_id AS session_id,
              anyIf(e.client_ip, e.client_ip != '') AS client_ip
            FROM ${CLICKHOUSE_EVENTS_TABLE} AS e
            WHERE e.workspace_id = {wid:UUID}
              AND e.session_id IN {sids:Array(String)}
            GROUP BY e.workspace_id, e.session_id
          `,
        })
        const rows =
          (
            (await res.json()) as CHJson<{
              workspace_id: string
              session_id: string
              client_ip: string
            }>
          ).data ?? []
        for (const row of rows) {
          const ip = String(row.client_ip || '').trim().slice(0, 45)
          if (!ip) continue
          out.set(`${row.workspace_id}:${row.session_id}`, ip)
        }
      } catch (err) {
        console.error('[lead-fraud] loadClientIpBySessions failed', err)
      }
    }
  }
  return out
}

async function attachSessionClientIps(
  rows: LeadSessionSignalRow[],
): Promise<LeadSessionSignalRow[]> {
  const missing = rows.filter((row) => !row.clientIp.trim())
  if (missing.length === 0) return rows
  const ipByKey = await loadClientIpBySessions(
    missing.map((row) => ({
      workspaceId: row.workspaceId,
      sessionId: row.sessionId,
    })),
  )
  if (ipByKey.size === 0) return rows
  return rows.map((row) => {
    if (row.clientIp.trim()) return row
    const ip = ipByKey.get(`${row.workspaceId}:${row.sessionId}`)
    return ip ? { ...row, clientIp: ip } : row
  })
}

/**
 * Lightweight per-session context (geo/network/tenant/ip) that does not depend
 * on lead-shaped event filters. Used to enrich scoring when the heavy signal
 * query is thin or fails.
 */
export async function loadSessionContextByIds(
  workspaceId: string,
  sessionIds: string[],
): Promise<Map<string, LeadSessionSignalRow>> {
  const out = new Map<string, LeadSessionSignalRow>()
  const wid = workspaceId.trim()
  const sids = [
    ...new Set(sessionIds.map((s) => s.trim()).filter(Boolean)),
  ]
  if (!wid || sids.length === 0) return out

  const ch = getClickHouseClient()
  let lastError: unknown = null
  for (const selectSql of SESSION_CONTEXT_SELECTS) {
    try {
      const res = await ch.query({
        format: 'JSON',
        query_params: { wid, sids },
        query: `
          SELECT ${selectSql}
          FROM ${CLICKHOUSE_EVENTS_TABLE} AS e
          WHERE e.workspace_id = {wid:UUID}
            AND e.session_id IN {sids:Array(String)}
          GROUP BY e.workspace_id, e.session_id
        `,
      })
      const rows = ((await res.json()) as CHJson<RawSignalRow>).data ?? []
      for (const row of rows) {
        const mapped = mapRow(row)
        if (mapped) out.set(mapped.sessionId, mapped)
      }
      lastError = null
      break
    } catch (err) {
      lastError = err
    }
  }
  if (lastError) {
    console.error('[lead-fraud] loadSessionContextByIds failed', lastError)
  }

  const withIp = await attachSessionClientIps([...out.values()])
  return new Map(withIp.map((row) => [row.sessionId, row] as const))
}

const VELOCITY_NEIGHBOR_SELECT = `
  ${LEAD_SESSION_SELECT_CORE},
  '{}' AS props,
  ${LEAD_SESSION_SELECT_MINIMAL_EXTRAS}
`

function timeWindowWhere(
  createdFromMs: number | undefined,
  createdToMs: number | undefined,
  query_params: Record<string, unknown>,
): string {
  let sql = ''
  if (
    typeof createdFromMs === 'number' &&
    Number.isFinite(createdFromMs) &&
    createdFromMs > 0
  ) {
    sql += ' AND e.created_at >= fromUnixTimestamp64Milli({from_ms:Int64})'
    query_params.from_ms = Math.floor(createdFromMs)
  }
  if (
    typeof createdToMs === 'number' &&
    Number.isFinite(createdToMs) &&
    createdToMs > 0
  ) {
    sql += ' AND e.created_at <= fromUnixTimestamp64Milli({to_ms:Int64})'
    query_params.to_ms = Math.floor(createdToMs)
  }
  return sql
}


export async function loadVelocityNeighborRows(input: {
  workspaceId: string
  fingerprints: string[]
  ipHashes: string[]
  createdFromMs?: number
  createdToMs?: number
  limit?: number
}): Promise<LeadSessionSignalRow[]> {
  const wid = input.workspaceId.trim()
  const fps = [...new Set(input.fingerprints.map((s) => s.trim()).filter(Boolean))]
  const iphs = [...new Set(input.ipHashes.map((s) => s.trim()).filter(Boolean))]
  if (!wid || (fps.length === 0 && iphs.length === 0)) return []

  const query_params: Record<string, unknown> = { wid, fps, iphs }
  let whereExtra = ' AND e.workspace_id = {wid:UUID}'
  whereExtra +=
    ' AND (e.fingerprint IN {fps:Array(String)} OR e.client_ip_hash IN {iphs:Array(String)})'
  whereExtra += timeWindowWhere(input.createdFromMs, input.createdToMs, query_params)

  try {
    return await queryLeadSessions(
      VELOCITY_NEIGHBOR_SELECT,
      LEAD_SESSION_WHERE,
      whereExtra,
      query_params,
      input.limit ?? 20_000,
    )
  } catch (err) {
    console.error('[lead-fraud] loadVelocityNeighborRows failed', err)
    throw err
  }
}

export async function loadLeadSessionSignals(input?: {
  workspaceId?: string
  sessionIds?: string[]
  lookbackDays?: number
  createdFromMs?: number
  createdToMs?: number
  limit?: number
  newestFirst?: boolean
  withIpBackfill?: boolean
}): Promise<LeadSessionSignalRow[]> {
  const workspaceId = input?.workspaceId?.trim() || ''
  const sessionIds = [
    ...new Set((input?.sessionIds ?? []).map((s) => s.trim()).filter(Boolean)),
  ]
  const lookbackDays =
    typeof input?.lookbackDays === 'number' &&
    Number.isFinite(input.lookbackDays) &&
    input.lookbackDays > 0
      ? Math.min(90, Math.floor(input.lookbackDays))
      : 0
  const limit =
    typeof input?.limit === 'number' &&
    Number.isFinite(input.limit) &&
    input.limit > 0
      ? Math.min(100_000, Math.floor(input.limit))
      : 100_000

  let whereExtra = ''
  const query_params: Record<string, unknown> = {}
  if (workspaceId) {
    whereExtra += ' AND e.workspace_id = {wid:UUID}'
    query_params.wid = workspaceId
  }
  if (sessionIds.length > 0) {
    whereExtra += ' AND e.session_id IN {sids:Array(String)}'
    query_params.sids = sessionIds
  }
  if (lookbackDays > 0) {
    whereExtra +=
      " AND e.created_at >= now64(3, 'UTC') - toIntervalDay({lookback:UInt32})"
    query_params.lookback = lookbackDays
  }
  whereExtra += timeWindowWhere(
    input?.createdFromMs,
    input?.createdToMs,
    query_params,
  )
  const orderBySql = input?.newestFirst ? 'ORDER BY max(e.created_at) DESC' : ''

 
  const whereClause =
    sessionIds.length > 0 ? `e.session_id != ''` : LEAD_SESSION_WHERE

  let rows: LeadSessionSignalRow[] = []
  let lastError: unknown = null
  for (const [shape, selectSql] of [
    ['full', LEAD_SESSION_SELECT],
    ['base', LEAD_SESSION_SELECT_BASE],
    ['minimal', LEAD_SESSION_SELECT_MINIMAL],
  ] as const) {
    try {
      rows = await queryLeadSessions(
        selectSql,
        whereClause,
        whereExtra,
        query_params,
        limit,
        orderBySql,
      )
      if (shape !== 'full') {
        console.warn(
          `[lead-fraud] loadLeadSessionSignals used ${shape} select shape`,
          lastError,
        )
      }
      lastError = null
      break
    } catch (err) {
      lastError = err
    }
  }
  if (lastError) {
    console.error('[lead-fraud] loadLeadSessionSignals failed', lastError)
    rows = []
  }

  if (
    sessionIds.length > 0 &&
    workspaceId &&
    rows.length < sessionIds.length
  ) {
    try {
      const ctx = await loadSessionContextByIds(workspaceId, sessionIds)
      const bySid = new Map(rows.map((row) => [row.sessionId, row] as const))
      for (const sid of sessionIds) {
        const existing = bySid.get(sid)
        const fallback = ctx.get(sid)
        if (!existing && fallback) {
          bySid.set(sid, fallback)
          continue
        }
        if (existing && fallback) {
          bySid.set(sid, {
            ...existing,
            tenantWorkspaceId:
              existing.tenantWorkspaceId || fallback.tenantWorkspaceId,
            geoZip: existing.geoZip || fallback.geoZip,
            geoState: existing.geoState || fallback.geoState,
            geoCountry: existing.geoCountry || fallback.geoCountry,
            geoCountryCode: existing.geoCountryCode || fallback.geoCountryCode,
            geoCity: existing.geoCity || fallback.geoCity,
            clientIp: existing.clientIp || fallback.clientIp,
            clientIpHash: existing.clientIpHash || fallback.clientIpHash,
            networkClass: existing.networkClass || fallback.networkClass,
            networkAsn: existing.networkAsn || fallback.networkAsn,
            networkOrg: existing.networkOrg || fallback.networkOrg,
            networkEvidenceSource:
              existing.networkEvidenceSource || fallback.networkEvidenceSource,
            networkEvidenceAsOf:
              existing.networkEvidenceAsOf || fallback.networkEvidenceAsOf,
            props:
              existing.props && existing.props !== '{}'
                ? existing.props
                : fallback.props,
            fingerprint: existing.fingerprint || fallback.fingerprint,
            phoneHash: existing.phoneHash || fallback.phoneHash,
            emailHash: existing.emailHash || fallback.emailHash,
          })
        }
      }
      rows = [...bySid.values()]
    } catch {
      /* keep rows as-is */
    }
  }

  if (input?.withIpBackfill === false) return rows
  return attachSessionClientIps(rows)
}
