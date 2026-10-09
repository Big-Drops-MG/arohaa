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

const LEAD_SESSION_SELECT = `
  toString(workspace_id) AS workspace_id,
  session_id,
  anyIf(fingerprint, fingerprint != '') AS fingerprint,
  anyIf(browser, browser != '') AS browser,
  max(nullIf(geo_zipcode, '')) AS geo_zip,
  anyIf(state, state != '') AS geo_state,
  anyIf(client_ip_hash, client_ip_hash != '') AS client_ip_hash,
  max(event_name IN ('form_submit', 'form_success', 'service_click')) AS form_submitted,
  argMax(properties, (length(properties), created_at)) AS props,
  max(nullIf(zipcode, '')) AS zip_val
`

const LEAD_SESSION_SELECT_NO_GEO_ZIP = `
  toString(workspace_id) AS workspace_id,
  session_id,
  anyIf(fingerprint, fingerprint != '') AS fingerprint,
  anyIf(browser, browser != '') AS browser,
  '' AS geo_zip,
  anyIf(state, state != '') AS geo_state,
  anyIf(client_ip_hash, client_ip_hash != '') AS client_ip_hash,
  max(event_name IN ('form_submit', 'form_success', 'service_click')) AS form_submitted,
  argMax(properties, (length(properties), created_at)) AS props,
  max(nullIf(zipcode, '')) AS zip_val
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

/**
 * Load lead/session signal rows used by Warehouse and Data Leads scoring.
 */
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
    return await queryLeadSessions(
      LEAD_SESSION_SELECT_NO_GEO_ZIP,
      whereExtra,
      query_params,
    )
  }
}
