import { CLICKHOUSE_EVENTS_TABLE } from '../clickhouse-events-table.js'
import { getClickHouseClient } from '../../services/clickhouse.service.js'
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
    geoState: String(row.geo_state || ''),
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
  session_id != ''
  AND (
    event_name IN ('form_submit', 'form_success')
    OR positionCaseInsensitive(properties, '"_k"') > 0
    OR positionCaseInsensitive(properties, '"fields"') > 0
  )
`

const LEAD_PROPS_EXPR = `
  coalesce(
    nullIf(
      argMaxIf(
        properties,
        (length(properties), created_at),
        event_name IN ('form_submit', 'form_success', 'form_step_complete')
      ),
      ''
    ),
    nullIf(
      argMaxIf(
        properties,
        (length(properties), created_at),
        event_name != '_fi'
          AND (
            positionCaseInsensitive(properties, '"_k"') > 0
            OR positionCaseInsensitive(properties, '"fields"') > 0
          )
      ),
      ''
    ),
    ''
  )
`

const LEAD_SESSION_SELECT = `
  toString(workspace_id) AS workspace_id,
  session_id,
  anyIf(fingerprint, fingerprint != '') AS fingerprint,
  anyIf(browser, browser != '') AS browser,
  max(nullIf(geo_zipcode, '')) AS geo_zip,
  anyIf(state_code, state_code != '') AS geo_state,
  anyIf(country, country != '') AS geo_country,
  anyIf(country_code, country_code != '') AS geo_country_code,
  anyIf(city, city != '') AS geo_city,
  anyIf(client_ip, client_ip != '') AS client_ip,
  anyIf(client_ip_hash, client_ip_hash != '') AS client_ip_hash,
  max(event_name IN ('form_submit', 'form_success', 'service_click')) AS form_submitted,
  ${LEAD_PROPS_EXPR} AS props,
  coalesce(
    nullIf(max(form_zip_entered), ''),
    nullIf(max(zipcode), '')
  ) AS zip_val,
  toString(max(created_at)) AS submitted_at,
  anyIf(tenant_workspace_id, tenant_workspace_id != '') AS tenant_workspace_id,
  anyIf(phone_hash, phone_hash != '') AS phone_hash,
  anyIf(email_hash, email_hash != '') AS email_hash,
  anyIf(event_id, event_id != '') AS event_id,
  anyIf(utm_source, utm_source != '') AS utm_source,
  nullIf(
    argMinIf(utm_source, created_at, utm_source != ''),
    ''
  ) AS first_utm_source,
  anyIf(utm_s1, utm_s1 != '') AS utm_s1,
  anyIf(utm_campaign, utm_campaign != '') AS utm_campaign,
  anyIf(network_class, network_class != '') AS network_class,
  anyIf(network_asn, network_asn > 0) AS network_asn,
  anyIf(network_org, network_org != '') AS network_org,
  anyIf(network_evidence_source, network_evidence_source != '') AS network_evidence_source,
  anyIf(network_evidence_as_of, network_evidence_as_of != '') AS network_evidence_as_of
`

const LEAD_SESSION_SELECT_BASE = `
  toString(workspace_id) AS workspace_id,
  session_id,
  anyIf(fingerprint, fingerprint != '') AS fingerprint,
  anyIf(browser, browser != '') AS browser,
  max(nullIf(geo_zipcode, '')) AS geo_zip,
  anyIf(state_code, state_code != '') AS geo_state,
  anyIf(country, country != '') AS geo_country,
  '' AS geo_country_code,
  anyIf(city, city != '') AS geo_city,
  anyIf(client_ip, client_ip != '') AS client_ip,
  anyIf(client_ip_hash, client_ip_hash != '') AS client_ip_hash,
  max(event_name IN ('form_submit', 'form_success', 'service_click')) AS form_submitted,
  ${LEAD_PROPS_EXPR} AS props,
  max(nullIf(zipcode, '')) AS zip_val,
  toString(max(created_at)) AS submitted_at
`

const LEAD_SESSION_SELECT_MINIMAL = `
  toString(workspace_id) AS workspace_id,
  session_id,
  anyIf(fingerprint, fingerprint != '') AS fingerprint,
  anyIf(browser, browser != '') AS browser,
  '' AS geo_zip,
  anyIf(state, state != '') AS geo_state,
  anyIf(country, country != '') AS geo_country,
  '' AS geo_country_code,
  anyIf(city, city != '') AS geo_city,
  '' AS client_ip,
  anyIf(client_ip_hash, client_ip_hash != '') AS client_ip_hash,
  max(event_name IN ('form_submit', 'form_success', 'service_click')) AS form_submitted,
  ${LEAD_PROPS_EXPR} AS props,
  max(nullIf(zipcode, '')) AS zip_val,
  toString(max(created_at)) AS submitted_at
`

async function queryLeadSessions(
  selectSql: string,
  whereExtra: string,
  query_params: Record<string, unknown>,
  limit = 100_000,
): Promise<LeadSessionSignalRow[]> {
  const ch = getClickHouseClient()
  const res = await ch.query({
    format: 'JSON',
    query_params: {
      ...query_params,
      session_lim: Math.max(1, Math.min(100_000, Math.floor(limit))),
    },
    query: `
      SELECT
        ${selectSql}
      FROM ${CLICKHOUSE_EVENTS_TABLE}
      WHERE ${LEAD_SESSION_WHERE}
        ${whereExtra}
      GROUP BY workspace_id, session_id
      LIMIT {session_lim:UInt32}
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
              toString(workspace_id) AS workspace_id,
              session_id,
              anyIf(client_ip, client_ip != '') AS client_ip
            FROM ${CLICKHOUSE_EVENTS_TABLE}
            WHERE workspace_id = {wid:UUID}
              AND session_id IN {sids:Array(String)}
            GROUP BY workspace_id, session_id
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
      } catch {
        /* column may be missing until migrate; leave empty */
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

export async function loadLeadSessionSignals(input?: {
  workspaceId?: string
  sessionIds?: string[]
  lookbackDays?: number
  limit?: number
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
    whereExtra += ' AND workspace_id = {wid:UUID}'
    query_params.wid = workspaceId
  }
  if (sessionIds.length > 0) {
    whereExtra += ' AND session_id IN {sids:Array(String)}'
    query_params.sids = sessionIds
  }
  if (lookbackDays > 0) {
    whereExtra +=
      ' AND created_at >= now64(3, \'UTC\') - toIntervalDay({lookback:UInt32})'
    query_params.lookback = lookbackDays
  }

  let rows: LeadSessionSignalRow[]
  try {
    rows = await queryLeadSessions(
      LEAD_SESSION_SELECT,
      whereExtra,
      query_params,
      limit,
    )
  } catch {
    try {
      rows = await queryLeadSessions(
        LEAD_SESSION_SELECT_BASE,
        whereExtra,
        query_params,
        limit,
      )
    } catch {
      rows = await queryLeadSessions(
        LEAD_SESSION_SELECT_MINIMAL,
        whereExtra,
        query_params,
        limit,
      )
    }
  }
  return attachSessionClientIps(rows)
}
