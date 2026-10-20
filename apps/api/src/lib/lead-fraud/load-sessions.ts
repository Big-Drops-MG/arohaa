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
  utm_s1?: string
  utm_campaign?: string
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
    utmS1: String(row.utm_s1 || '').trim() || undefined,
    utmCampaign: String(row.utm_campaign || '').trim() || undefined,
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
  anyIf(state, state != '') AS geo_state,
  anyIf(client_ip_hash, client_ip_hash != '') AS client_ip_hash,
  max(event_name IN ('form_submit', 'form_success', 'service_click')) AS form_submitted,
  ${LEAD_PROPS_EXPR} AS props,
  max(nullIf(zipcode, '')) AS zip_val,
  toString(max(created_at)) AS submitted_at,
  anyIf(tenant_workspace_id, tenant_workspace_id != '') AS tenant_workspace_id,
  anyIf(phone_hash, phone_hash != '') AS phone_hash,
  anyIf(email_hash, email_hash != '') AS email_hash,
  anyIf(event_id, event_id != '') AS event_id,
  anyIf(utm_source, utm_source != '') AS utm_source,
  anyIf(utm_s1, utm_s1 != '') AS utm_s1,
  anyIf(utm_campaign, utm_campaign != '') AS utm_campaign
`

const LEAD_SESSION_SELECT_BASE = `
  toString(workspace_id) AS workspace_id,
  session_id,
  anyIf(fingerprint, fingerprint != '') AS fingerprint,
  anyIf(browser, browser != '') AS browser,
  max(nullIf(geo_zipcode, '')) AS geo_zip,
  anyIf(state, state != '') AS geo_state,
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
): Promise<LeadSessionSignalRow[]> {
  const ch = getClickHouseClient()
  const res = await ch.query({
    format: 'JSON',
    query_params,
    query: `
      SELECT
        ${selectSql}
      FROM ${CLICKHOUSE_EVENTS_TABLE}
      WHERE ${LEAD_SESSION_WHERE}
        ${whereExtra}
      GROUP BY workspace_id, session_id
      LIMIT 100000
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

export async function loadLeadSessionSignals(input?: {
  workspaceId?: string
  sessionIds?: string[]
}): Promise<LeadSessionSignalRow[]> {
  const workspaceId = input?.workspaceId?.trim() || ''
  const sessionIds = [
    ...new Set((input?.sessionIds ?? []).map((s) => s.trim()).filter(Boolean)),
  ]

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

  try {
    return await queryLeadSessions(
      LEAD_SESSION_SELECT,
      whereExtra,
      query_params,
    )
  } catch {
    try {
      return await queryLeadSessions(
        LEAD_SESSION_SELECT_BASE,
        whereExtra,
        query_params,
      )
    } catch {
      return await queryLeadSessions(
        LEAD_SESSION_SELECT_MINIMAL,
        whereExtra,
        query_params,
      )
    }
  }
}
