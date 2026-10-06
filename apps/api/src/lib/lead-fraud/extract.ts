import {
  decryptFieldBlob,
  decryptJsonBlob,
  FI_EVENT_NAME,
  OPAQUE_PROP_KEY,
} from '../field-blob.js'
import {
  normalizeLeadFields,
  pickLeadEmail,
  pickLeadZip,
  pickTrustedFormUrl,
} from '../lead-fields.js'
import { CLICKHOUSE_EVENTS_TABLE } from '../clickhouse-events-table.js'
import { getClickHouseClient } from '../../services/clickhouse.service.js'
import {
  FP_REUSE_DAY_THRESHOLD,
  VELOCITY_WINDOW_HOURS,
} from './constants.js'
import { emailDomain } from './disposable-domains.js'
import { emptyFeatures, parseFiBehavior } from './features.js'
import type { FiLogItem, LeadFraudFeatures } from './types.js'

type CHJson<T> = { data: T[] }

type SessionAggRow = {
  fingerprint: string
  browser: string
  geo_zip: string
  geo_state: string
  client_ip_hash: string
  form_submitted: number | boolean | string
  props: string
  zip_val: string
}

type FiRow = {
  properties: string
  created_at: string
}

function extractRawFieldMap(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const props = parsed as Record<string, unknown>
    const blob = props._k
    if (typeof blob === 'string' && blob.length > 0) {
      const decrypted = decryptFieldBlob(blob)
      if (decrypted) return decrypted
    }
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

function flattenFiItems(payload: unknown, eventCreatedAt: string): FiLogItem[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return []
  const p = payload as { s?: unknown; i?: unknown }
  const items = Array.isArray(p.i) ? p.i : []
  const startedAtMs =
    typeof p.s === 'number' && Number.isFinite(p.s) ? p.s : null
  const out: FiLogItem[] = []
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const row = item as { m?: unknown; t?: unknown; k?: unknown }
    const message = typeof row.m === 'string' ? row.m : ''
    if (!message) continue
    const offsetMs =
      typeof row.t === 'number' && Number.isFinite(row.t)
        ? Math.max(0, Math.floor(row.t))
        : 0
    const kind =
      typeof row.k === 'number' && Number.isFinite(row.k)
        ? Math.trunc(row.k)
        : null
    void eventCreatedAt
    void startedAtMs
    out.push({ offsetMs, message, kind })
  }
  return out
}

async function loadFiItems(
  workspaceId: string,
  sessionId: string,
): Promise<FiLogItem[]> {
  const ch = getClickHouseClient()
  const res = await ch.query({
    format: 'JSON',
    query_params: { wid: workspaceId, sid: sessionId, ev: FI_EVENT_NAME },
    query: `
      SELECT properties, toString(created_at) AS created_at
      FROM ${CLICKHOUSE_EVENTS_TABLE}
      WHERE workspace_id = {wid:UUID}
        AND session_id = {sid:String}
        AND event_name = {ev:String}
      ORDER BY created_at ASC
      LIMIT 200
    `,
  })
  const rows = ((await res.json()) as CHJson<FiRow>).data ?? []
  const items: FiLogItem[] = []
  for (const row of rows) {
    try {
      const props = JSON.parse(row.properties || '{}') as Record<string, unknown>
      const blob = props[OPAQUE_PROP_KEY]
      if (typeof blob !== 'string' || !blob) continue
      const decrypted = decryptJsonBlob(blob)
      items.push(...flattenFiItems(decrypted, row.created_at))
    } catch {
      /* skip */
    }
  }
  return items
}

async function loadVelocity(
  workspaceId: string,
  fingerprint: string,
  ipHash: string,
  domain: string,
): Promise<{
  fingerprintSessionsSameDay: number
  fingerprintSubmits24h: number
  ipHashSubmits24h: number
  emailDomainSubmits24h: number
}> {
  const ch = getClickHouseClient()
  const empty = {
    fingerprintSessionsSameDay: 0,
    fingerprintSubmits24h: 0,
    ipHashSubmits24h: 0,
    emailDomainSubmits24h: 0,
  }
  if (!fingerprint && !ipHash && !domain) return empty

  const res = await ch.query({
    format: 'JSON',
    query_params: {
      wid: workspaceId,
      fp: fingerprint,
      iph: ipHash,
      hours: VELOCITY_WINDOW_HOURS,
    },
    query: `
      SELECT
        if({fp:String} = '', 0, uniqExactIf(session_id, fingerprint = {fp:String} AND created_at >= now64(3) - INTERVAL 1 DAY)) AS fp_sessions_day,
        if({fp:String} = '', 0, uniqExactIf(session_id, fingerprint = {fp:String} AND event_name IN ('form_success','service_click') AND created_at >= now64(3) - INTERVAL {hours:UInt32} HOUR)) AS fp_submits,
        if({iph:String} = '', 0, uniqExactIf(session_id, client_ip_hash = {iph:String} AND event_name IN ('form_success','service_click') AND created_at >= now64(3) - INTERVAL {hours:UInt32} HOUR)) AS ip_submits
      FROM ${CLICKHOUSE_EVENTS_TABLE}
      WHERE workspace_id = {wid:UUID}
    `,
  })
  const row = (
    (await res.json()) as CHJson<{
      fp_sessions_day: string
      fp_submits: string
      ip_submits: string
    }>
  ).data?.[0]

  // Email domain velocity is approximate via properties search when domain present
  let emailDomainSubmits24h = 0
  if (domain) {
    try {
      const dRes = await ch.query({
        format: 'JSON',
        query_params: { wid: workspaceId, dom: `@${domain}`, hours: VELOCITY_WINDOW_HOURS },
        query: `
          SELECT uniqExact(session_id) AS n
          FROM ${CLICKHOUSE_EVENTS_TABLE}
          WHERE workspace_id = {wid:UUID}
            AND event_name IN ('form_success','service_click')
            AND created_at >= now64(3) - INTERVAL {hours:UInt32} HOUR
            AND positionCaseInsensitive(properties, {dom:String}) > 0
        `,
      })
      emailDomainSubmits24h =
        Number(
          ((await dRes.json()) as CHJson<{ n: string }>).data?.[0]?.n ?? 0,
        ) || 0
    } catch {
      emailDomainSubmits24h = 0
    }
  }

  return {
    fingerprintSessionsSameDay: Number(row?.fp_sessions_day ?? 0) || 0,
    fingerprintSubmits24h: Number(row?.fp_submits ?? 0) || 0,
    ipHashSubmits24h: Number(row?.ip_submits ?? 0) || 0,
    emailDomainSubmits24h,
  }
}

export async function extractLeadFraudFeatures(input: {
  workspaceId: string
  sessionId: string
}): Promise<LeadFraudFeatures> {
  const ch = getClickHouseClient()
  const aggRes = await ch.query({
    format: 'JSON',
    query_params: { wid: input.workspaceId, sid: input.sessionId },
    query: `
      SELECT
        anyIf(fingerprint, fingerprint != '') AS fingerprint,
        anyIf(browser, browser != '') AS browser,
        max(nullIf(geo_zipcode, '')) AS geo_zip,
        anyIf(state, state != '') AS geo_state,
        anyIf(client_ip_hash, client_ip_hash != '') AS client_ip_hash,
        max(event_name IN ('form_success','service_click')) AS form_submitted,
        argMax(properties, (length(properties), created_at)) AS props,
        max(nullIf(zipcode, '')) AS zip_val
      FROM ${CLICKHOUSE_EVENTS_TABLE}
      WHERE workspace_id = {wid:UUID}
        AND session_id = {sid:String}
    `,
  })
  const agg =
    ((await aggRes.json()) as CHJson<SessionAggRow>).data?.[0] ?? null

  const rawFields = extractRawFieldMap(agg?.props || '{}')
  const fields = normalizeLeadFields(rawFields)
  const email = pickLeadEmail(fields)
  const zip = (agg?.zip_val || pickLeadZip(fields) || '').trim()
  const fiItems = await loadFiItems(input.workspaceId, input.sessionId)
  const behavior = parseFiBehavior(fiItems)
  const fingerprint = (agg?.fingerprint || '').trim()
  const ipHash = (agg?.client_ip_hash || '').trim()
  const domain = emailDomain(email)
  const velocity = await loadVelocity(
    input.workspaceId,
    fingerprint,
    ipHash,
    domain,
  )

  void FP_REUSE_DAY_THRESHOLD

  return emptyFeatures({
    fingerprint,
    browser: (agg?.browser || '').trim(),
    formSubmitted: Boolean(
      agg?.form_submitted === true ||
        agg?.form_submitted === 1 ||
        agg?.form_submitted === '1',
    ),
    email,
    firstName: (fields.first_name || '').trim(),
    lastName: (fields.last_name || '').trim(),
    zip,
    geoZip: (agg?.geo_zip || '').trim(),
    stateField: (fields.state || '').trim(),
    geoState: (agg?.geo_state || '').trim(),
    trustedFormUrl: pickTrustedFormUrl(rawFields),
    clientIpHash: ipHash,
    ...behavior,
    ...velocity,
    fieldCount: Object.keys(fields).length + (email ? 1 : 0) + (zip ? 1 : 0),
  })
}
