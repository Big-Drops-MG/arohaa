import { CLICKHOUSE_EVENTS_TABLE } from '../lib/clickhouse-events-table.js'
import { decryptFieldBlob } from '../lib/field-blob.js'
import {
  normalizeLeadFields,
  pickLeadEmail,
  pickLeadZip,
  pickTrustedFormUrl,
} from '../lib/lead-fields.js'
import { LEAD_FRAUD_MODEL_VERSION } from '../lib/lead-fraud/constants.js'
import { emailDomain } from '../lib/lead-fraud/disposable-domains.js'
import { emptyFeatures } from '../lib/lead-fraud/features.js'
import { upsertLeadRiskBatch } from '../lib/lead-fraud/persist.js'
import { scoreLeadFraud } from '../lib/lead-fraud/score.js'
import type {
  LeadFraudAssessment,
  LeadFraudFeatures,
} from '../lib/lead-fraud/types.js'
import {
  getClickHouseClient,
  LEAD_RISK_TABLE,
  shouldSkipClickHouse,
} from './clickhouse.service.js'
import {
  count,
  db,
  isNull,
  landingPages,
  users,
  workspaces,
} from '@workspace/database'

type CHJson<T> = { data: T[] }

export type WarehouseNameCount = {
  name: string
  count: number
}

export type WarehouseDomainCount = {
  domain: string
  count: number
  legit: number
  fraud: number
}

export type WarehouseSummary = {
  totals: {
    events: number
    sessions: number
    visitors: number
    workspacesWithEvents: number
    formStarts: number
    formSubmits: number
    formSuccesses: number
    scoredLeads: number
    landingPages: number
    workspaces: number
    users: number
  }
  volume: {
    lastHour: number
    last24h: number
    last7d: number
  }
  risk: {
    legit: number
    fraud: number
    unscoredFormSubmits: number
  }
  clicks: {
    total: number
    byName: WarehouseNameCount[]
  }
  eventsByName: WarehouseNameCount[]
  emailDomains: WarehouseDomainCount[]
  /** Top signals that caused Fraud classifications across leads. */
  fraudReasons: WarehouseNameCount[]
  generatedAt: string
}

const CLICK_EVENT_NAMES = [
  'button_click',
  'link_click',
  'heatmap_click',
  'call_click',
  'service_click',
] as const

function n(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

async function queryJson<T>(query: string): Promise<T[]> {
  const ch = getClickHouseClient()
  const res = await ch.query({ query, format: 'JSON' })
  return ((await res.json()) as CHJson<T>).data ?? []
}

async function loadPostgresTotals(): Promise<{
  landingPages: number
  workspaces: number
  users: number
}> {
  const [lpRow, wsRow, userRow] = await Promise.all([
    db
      .select({ total: count() })
      .from(landingPages)
      .where(isNull(landingPages.deletedAt)),
    db
      .select({ total: count() })
      .from(workspaces)
      .where(isNull(workspaces.deletedAt)),
    db.select({ total: count() }).from(users),
  ])
  return {
    landingPages: n(lpRow[0]?.total),
    workspaces: n(wsRow[0]?.total),
    users: n(userRow[0]?.total),
  }
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
      props.fields &&
      typeof props.fields === 'object' &&
      !Array.isArray(props.fields)
        ? (props.fields as Record<string, unknown>)
        : props
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(source)) {
      if (k === 'fields' || k === '_k') continue
      if (
        typeof v === 'string' ||
        typeof v === 'number' ||
        typeof v === 'boolean'
      ) {
        out[k] = String(v)
      }
    }
    return out
  } catch {
    return {}
  }
}

type LeadSessionRow = {
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

type WarehouseLeadInsights = {
  risk: {
    legit: number
    fraud: number
    unscoredFormSubmits: number
  }
  scoredLeads: number
  emailDomains: WarehouseDomainCount[]
  fraudReasons: WarehouseNameCount[]
}

function normalizeFraudReason(reason: string): string {
  return reason.replace(/\s*\(−\d+\s*trust\)\s*$/i, '').trim()
}

function parseReasonsJson(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((r): r is string => typeof r === 'string' && r.trim() !== '')
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (r): r is string => typeof r === 'string' && r.trim() !== '',
        )
      }
    } catch {
      /* ignore */
    }
  }
  return []
}

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1'
}

/**
 * Classify every lead/form-submit session with scoreLeadFraud.
 * Field signals only (no per-session FI round-trips) so warehouse can finish
 * against tens of thousands of sessions and still return real counts.
 */
async function loadWarehouseLeadInsights(): Promise<WarehouseLeadInsights> {
  const ch = getClickHouseClient()

  let leadRows: LeadSessionRow[] = []
  try {
    const leadRes = await ch.query({
      format: 'JSON',
      query: `
        SELECT
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
        FROM ${CLICKHOUSE_EVENTS_TABLE}
        WHERE session_id != ''
          AND (
            event_name IN ('form_submit', 'form_success')
            OR positionCaseInsensitive(properties, '"_k"') > 0
            OR positionCaseInsensitive(properties, '"fields"') > 0
          )
        GROUP BY workspace_id, session_id
        LIMIT 100000
      `,
    })
    leadRows = ((await leadRes.json()) as CHJson<LeadSessionRow>).data ?? []
  } catch {
    const leadRes = await ch.query({
      format: 'JSON',
      query: `
        SELECT
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
        FROM ${CLICKHOUSE_EVENTS_TABLE}
        WHERE session_id != ''
          AND (
            event_name IN ('form_submit', 'form_success')
            OR positionCaseInsensitive(properties, '"_k"') > 0
            OR positionCaseInsensitive(properties, '"fields"') > 0
          )
        GROUP BY workspace_id, session_id
        LIMIT 100000
      `,
    })
    leadRows = ((await leadRes.json()) as CHJson<LeadSessionRow>).data ?? []
  }

  const riskRes = await ch.query({
    format: 'JSON',
    query: `
      SELECT
        toString(workspace_id) AS workspace_id,
        session_id,
        label,
        model_version,
        features_json,
        reasons
      FROM ${LEAD_RISK_TABLE} FINAL
    `,
  })
  const riskRows =
    (
      (await riskRes.json()) as CHJson<{
        workspace_id: string
        session_id: string
        label: string
        model_version: string
        features_json: string
        reasons: unknown
      }>
    ).data ?? []

  const existingRisk = new Map<
    string,
    {
      label: 'legit' | 'fraud'
      modelVersion: string
      email: string
      reasons: string[]
    }
  >()
  for (const row of riskRows) {
    const wid = String(row.workspace_id || '').trim()
    const sid = String(row.session_id || '').trim()
    if (!wid || !sid) continue
    let email = ''
    try {
      const parsed = JSON.parse(row.features_json || '{}') as {
        email?: unknown
      }
      if (typeof parsed.email === 'string') email = parsed.email.trim()
    } catch {
      /* ignore */
    }
    const label: 'legit' | 'fraud' =
      row.label === 'legit' ? 'legit' : 'fraud'
    existingRisk.set(`${wid}:${sid}`, {
      label,
      modelVersion: String(row.model_version || ''),
      email,
      reasons: parseReasonsJson(row.reasons),
    })
  }

  const fpSubmitCounts = new Map<string, number>()
  const ipSubmitCounts = new Map<string, number>()
  const domainSubmitCounts = new Map<string, number>()
  const fpSessionCounts = new Map<string, number>()

  for (const row of leadRows) {
    const submitted = isTruthyFlag(row.form_submitted)
    const fp = (row.fingerprint || '').trim()
    const ip = (row.client_ip_hash || '').trim()
    if (fp) fpSessionCounts.set(fp, (fpSessionCounts.get(fp) ?? 0) + 1)
    if (!submitted) continue
    if (fp) fpSubmitCounts.set(fp, (fpSubmitCounts.get(fp) ?? 0) + 1)
    if (ip) ipSubmitCounts.set(ip, (ipSubmitCounts.get(ip) ?? 0) + 1)
    const email = pickLeadEmail(
      normalizeLeadFields(extractRawFieldMap(row.props || '{}')),
    )
    const domain = emailDomain(email)
    if (domain) {
      domainSubmitCounts.set(domain, (domainSubmitCounts.get(domain) ?? 0) + 1)
    }
  }

  const labelByKey = new Map<string, 'legit' | 'fraud'>()
  const emailByKey = new Map<string, string>()
  const fraudReasonCounts = new Map<string, number>()
  const toPersist: Array<{
    workspaceId: string
    sessionId: string
    assessment: LeadFraudAssessment
    features: LeadFraudFeatures
  }> = []
  let failed = 0

  function addFraudReasons(reasons: string[]) {
    for (const reason of reasons) {
      const key = normalizeFraudReason(reason)
      if (!key) continue
      fraudReasonCounts.set(key, (fraudReasonCounts.get(key) ?? 0) + 1)
    }
  }

  for (const row of leadRows) {
    const wid = String(row.workspace_id || '').trim()
    const sid = String(row.session_id || '').trim()
    if (!wid || !sid) continue
    const key = `${wid}:${sid}`

    try {
      const rawFields = extractRawFieldMap(row.props || '{}')
      const fields = normalizeLeadFields(rawFields)
      const email = pickLeadEmail(fields)
      if (email.includes('@')) emailByKey.set(key, email)

      const existing = existingRisk.get(key)
      if (existing && existing.modelVersion === LEAD_FRAUD_MODEL_VERSION) {
        labelByKey.set(key, existing.label)
        if (!email.includes('@') && existing.email.includes('@')) {
          emailByKey.set(key, existing.email)
        }
        if (existing.label === 'fraud') addFraudReasons(existing.reasons)
        continue
      }

      const zip = (row.zip_val || pickLeadZip(fields) || '').trim()
      const fingerprint = (row.fingerprint || '').trim()
      const ipHash = (row.client_ip_hash || '').trim()
      const domain = emailDomain(email)
      const formSubmitted = isTruthyFlag(row.form_submitted)

      const features = emptyFeatures({
        fingerprint,
        browser: (row.browser || '').trim(),
        formSubmitted,
        email,
        firstName: (fields.first_name || '').trim(),
        lastName: (fields.last_name || '').trim(),
        zip,
        geoZip: (row.geo_zip || '').trim(),
        stateField: (fields.state || '').trim(),
        geoState: (row.geo_state || '').trim(),
        trustedFormUrl: pickTrustedFormUrl(rawFields),
        clientIpHash: ipHash,
        hasFormStarted: formSubmitted,
        hasFieldInteraction: formSubmitted || Boolean(email || zip),
        fillDurationMs: null,
        typedCount: formSubmitted ? 1 : 0,
        pasteCount: 0,
        pastedEmail: false,
        pastedName: false,
        pastedPhone: false,
        fingerprintSessionsSameDay: fingerprint
          ? (fpSessionCounts.get(fingerprint) ?? 0)
          : 0,
        fingerprintSubmits24h: fingerprint
          ? (fpSubmitCounts.get(fingerprint) ?? 0)
          : 0,
        ipHashSubmits24h: ipHash ? (ipSubmitCounts.get(ipHash) ?? 0) : 0,
        emailDomainSubmits24h: domain
          ? (domainSubmitCounts.get(domain) ?? 0)
          : 0,
        fieldCount:
          Object.keys(fields).length + (email ? 1 : 0) + (zip ? 1 : 0),
      })

      const assessment = scoreLeadFraud(features)
      labelByKey.set(key, assessment.label)
      if (assessment.label === 'fraud') addFraudReasons(assessment.reasons)
      toPersist.push({
        workspaceId: wid,
        sessionId: sid,
        assessment,
        features,
      })
    } catch {
      failed += 1
    }
  }

  if (toPersist.length > 0) {
    void upsertLeadRiskBatch(toPersist).catch(() => {
      /* counts already computed in-memory */
    })
  }

  let legit = 0
  let fraud = 0
  for (const label of labelByKey.values()) {
    if (label === 'legit') legit += 1
    else fraud += 1
  }

  const domainAcc = new Map<
    string,
    { count: number; legit: number; fraud: number }
  >()
  for (const [key, email] of emailByKey) {
    const domain = emailDomain(email)
    if (!domain) continue
    const cur = domainAcc.get(domain) ?? { count: 0, legit: 0, fraud: 0 }
    cur.count += 1
    const label = labelByKey.get(key)
    if (label === 'legit') cur.legit += 1
    else if (label === 'fraud') cur.fraud += 1
    domainAcc.set(domain, cur)
  }

  const emailDomains = [...domainAcc.entries()]
    .map(([domain, stats]) => ({
      domain,
      count: stats.count,
      legit: stats.legit,
      fraud: stats.fraud,
    }))
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain))
    .slice(0, 100)

  const fraudReasons = [...fraudReasonCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 25)

  const scoredLeads = legit + fraud
  return {
    risk: {
      legit,
      fraud,
      unscoredFormSubmits: Math.max(0, failed),
    },
    scoredLeads,
    emailDomains,
    fraudReasons,
  }
}

function emptySummary(generatedAt: string): WarehouseSummary {
  return {
    totals: {
      events: 0,
      sessions: 0,
      visitors: 0,
      workspacesWithEvents: 0,
      formStarts: 0,
      formSubmits: 0,
      formSuccesses: 0,
      scoredLeads: 0,
      landingPages: 0,
      workspaces: 0,
      users: 0,
    },
    volume: { lastHour: 0, last24h: 0, last7d: 0 },
    risk: { legit: 0, fraud: 0, unscoredFormSubmits: 0 },
    clicks: { total: 0, byName: [] },
    eventsByName: [],
    emailDomains: [],
    fraudReasons: [],
    generatedAt,
  }
}

export async function getWarehouseSummary(): Promise<WarehouseSummary> {
  const generatedAt = new Date().toISOString()

  if (shouldSkipClickHouse()) {
    const pg = await loadPostgresTotals().catch(() => ({
      landingPages: 0,
      workspaces: 0,
      users: 0,
    }))
    const empty = emptySummary(generatedAt)
    empty.totals.landingPages = pg.landingPages
    empty.totals.workspaces = pg.workspaces
    empty.totals.users = pg.users
    return empty
  }

  const clickList = CLICK_EVENT_NAMES.map((name) => `'${name}'`).join(', ')

  // Score leads first so a slow CH inventory query cannot starve classification.
  let leadInsights: WarehouseLeadInsights
  try {
    leadInsights = await loadWarehouseLeadInsights()
  } catch (err) {
    console.error('[warehouse] lead insights failed', err)
    leadInsights = {
      risk: { legit: 0, fraud: 0, unscoredFormSubmits: 0 },
      scoredLeads: 0,
      emailDomains: [],
      fraudReasons: [],
    }
  }

  const [totalsRows, volumeRows, eventNameRows, clickRows, pg] =
    await Promise.all([
      queryJson<{
        events: string | number
        sessions: string | number
        visitors: string | number
        workspaces_with_events: string | number
        form_starts: string | number
        form_submits: string | number
        form_successes: string | number
        click_events: string | number
      }>(`
      SELECT
        count() AS events,
        uniqExact(session_id) AS sessions,
        uniqExact(if(user_id = '', fingerprint, user_id)) AS visitors,
        uniqExact(workspace_id) AS workspaces_with_events,
        countIf(event_name = 'form_start') AS form_starts,
        countIf(event_name = 'form_submit') AS form_submits,
        countIf(event_name = 'form_success') AS form_successes,
        countIf(event_name IN (${clickList})) AS click_events
      FROM ${CLICKHOUSE_EVENTS_TABLE}
    `),
      queryJson<{
        last_hour: string | number
        last_24h: string | number
        last_7d: string | number
      }>(`
      SELECT
        countIf(created_at >= now() - INTERVAL 1 HOUR) AS last_hour,
        countIf(created_at >= now() - INTERVAL 24 HOUR) AS last_24h,
        countIf(created_at >= now() - INTERVAL 7 DAY) AS last_7d
      FROM ${CLICKHOUSE_EVENTS_TABLE}
    `),
      queryJson<{
        event_name: string
        c: string | number
      }>(`
      SELECT
        event_name,
        count() AS c
      FROM ${CLICKHOUSE_EVENTS_TABLE}
      GROUP BY event_name
      ORDER BY c DESC
    `),
      queryJson<{
        event_name: string
        c: string | number
      }>(`
      SELECT
        event_name,
        count() AS c
      FROM ${CLICKHOUSE_EVENTS_TABLE}
      WHERE event_name IN (${clickList})
      GROUP BY event_name
      ORDER BY c DESC
    `),
      loadPostgresTotals().catch(() => ({
        landingPages: 0,
        workspaces: 0,
        users: 0,
      })),
    ])

  const totalsRow = totalsRows[0]
  const volumeRow = volumeRows[0]

  return {
    totals: {
      events: n(totalsRow?.events),
      sessions: n(totalsRow?.sessions),
      visitors: n(totalsRow?.visitors),
      workspacesWithEvents: n(totalsRow?.workspaces_with_events),
      formStarts: n(totalsRow?.form_starts),
      formSubmits: n(totalsRow?.form_submits),
      formSuccesses: n(totalsRow?.form_successes),
      scoredLeads: leadInsights.scoredLeads,
      landingPages: pg.landingPages,
      workspaces: pg.workspaces,
      users: pg.users,
    },
    volume: {
      lastHour: n(volumeRow?.last_hour),
      last24h: n(volumeRow?.last_24h),
      last7d: n(volumeRow?.last_7d),
    },
    risk: leadInsights.risk,
    clicks: {
      total: n(totalsRow?.click_events),
      byName: clickRows.map((row) => ({
        name: row.event_name,
        count: n(row.c),
      })),
    },
    eventsByName: eventNameRows.map((row) => ({
      name: row.event_name || '(empty)',
      count: n(row.c),
    })),
    emailDomains: leadInsights.emailDomains,
    fraudReasons: leadInsights.fraudReasons,
    generatedAt,
  }
}
