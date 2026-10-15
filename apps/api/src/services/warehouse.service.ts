import { CLICKHOUSE_EVENTS_TABLE } from '../lib/clickhouse-events-table.js'
import {
  fieldsWithoutReserved,
  normalizeLeadFields,
  pickLeadEmail,
  pickLeadZip,
  pickTrustedFormUrl,
} from '../lib/lead-fields.js'
import { LEAD_FRAUD_MODEL_VERSION } from '../lib/lead-fraud/constants.js'
import { emailDomain } from '../lib/lead-fraud/disposable-domains.js'
import {
  extractRawFieldMap,
  type LeadSessionSignalRow,
} from '../lib/lead-fraud/field-signals.js'
import { loadLeadSessionSignals } from '../lib/lead-fraud/load-sessions.js'
import { upsertLeadRiskBatch } from '../lib/lead-fraud/persist.js'
import { classifyLeadSessionRows } from '../lib/lead-fraud/service.js'
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

export type WarehouseShortcutCount = {
  name: string
  label: string
  sessions: number
  percent: number
}

export type WarehouseFraudLead = {
  workspaceId: string
  sessionId: string
  macId: string
  createdAt: string
  submittedAt: string | null
  zip: string
  email: string
  firstName: string
  lastName: string
  utmSource: string
  utmId: string
  trustedFormUrl: string
  formSubmitted: boolean
  fields: Record<string, string>
  fraud: LeadFraudAssessment
}

export type WarehouseShortcutLead = {
  workspaceId: string
  sessionId: string
  macId: string
  createdAt: string
  submittedAt: string | null
  zip: string
  email: string
  firstName: string
  lastName: string
  utmSource: string
  utmId: string
  trustedFormUrl: string
  formSubmitted: boolean
  usedCopy: boolean
  usedPaste: boolean
  fields: Record<string, string>
  fraud: LeadFraudAssessment | null
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
  shortcuts: {
    formSessions: number
    byName: WarehouseShortcutCount[]
  }
  eventsByName: WarehouseNameCount[]
  emailDomains: WarehouseDomainCount[]
  fraudReasons: WarehouseNameCount[]
  fraudLeads: WarehouseFraudLead[]
  shortcutLeads: WarehouseShortcutLead[]
  generatedAt: string
}

const FRAUD_LEADS_LIMIT = 100
const SHORTCUT_LEADS_LIMIT = 100

const CLICK_EVENT_NAMES = [
  'button_click',
  'link_click',
  'heatmap_click',
  'call_click',
  'service_click',
] as const

const SHORTCUT_ROWS = [
  {
    name: 'form_shortcut_copy',
    label: 'Copy (Ctrl+C)',
  },
  {
    name: 'form_shortcut_paste',
    label: 'Paste (Ctrl+V)',
  },
] as const

function shortcutPercent(sessions: number, formSessions: number): number {
  if (formSessions <= 0 || sessions <= 0) return 0
  return Math.round((sessions / formSessions) * 1000) / 10
}

function n(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function formatFingerprintAsMacId(fingerprint: string): string {
  const hex = fingerprint.replace(/[^a-fA-F0-9]/g, '').toLowerCase()
  if (!hex) return ''
  const padded = hex.padEnd(12, '0').slice(0, 12)
  return padded.match(/.{2}/g)?.join(':') ?? ''
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

type WarehouseLeadInsights = {
  risk: {
    legit: number
    fraud: number
    unscoredFormSubmits: number
  }
  scoredLeads: number
  emailDomains: WarehouseDomainCount[]
  fraudReasons: WarehouseNameCount[]
  fraudLeads: WarehouseFraudLead[]
  shortcutLeads: WarehouseShortcutLead[]
}

type SessionMeta = {
  createdAt: string
  submittedAt: string | null
  utmSource: string
  utmId: string
  sampleUrl: string
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
    /* ignore */
  }
  return ''
}

function isValidLeadTimestamp(value: string | null | undefined): boolean {
  if (!value) return false
  const trimmed = value.trim()
  if (!trimmed || trimmed.startsWith('1970-')) return false
  return !Number.isNaN(new Date(trimmed.replace(' ', 'T')).getTime())
}

async function loadSessionMetaByKey(
  sessionIds: string[],
): Promise<Map<string, SessionMeta>> {
  const out = new Map<string, SessionMeta>()
  const sids = [...new Set(sessionIds.map((s) => s.trim()).filter(Boolean))]
  if (sids.length === 0) return out

  const ch = getClickHouseClient()
  const res = await ch.query({
    format: 'JSON',
    query_params: { sids },
    query: `
      SELECT
        toString(workspace_id) AS workspace_id,
        session_id,
        max(created_at) AS last_at,
        maxIf(created_at, event_name IN ('form_submit', 'form_success')) AS submitted_at,
        anyIf(utm_source, utm_source != '') AS utm_source,
        anyIf(utm_id, utm_id != '') AS utm_id,
        argMax(url, (length(properties), created_at)) AS sample_url
      FROM ${CLICKHOUSE_EVENTS_TABLE}
      WHERE session_id IN {sids:Array(String)}
      GROUP BY workspace_id, session_id
    `,
  })
  const rows =
    (
      (await res.json()) as CHJson<{
        workspace_id: string
        session_id: string
        last_at: string
        submitted_at: string
        utm_source: string
        utm_id: string
        sample_url: string
      }>
    ).data ?? []

  for (const row of rows) {
    const wid = String(row.workspace_id || '').trim()
    const sid = String(row.session_id || '').trim()
    if (!wid || !sid) continue
    const sampleUrl = String(row.sample_url || '')
    out.set(`${wid}:${sid}`, {
      createdAt: String(row.last_at || ''),
      submittedAt: isValidLeadTimestamp(row.submitted_at)
        ? String(row.submitted_at).trim()
        : null,
      utmSource:
        String(row.utm_source || '').trim() ||
        pickQueryParam(sampleUrl, ['utm_source', 'sid']),
      utmId:
        String(row.utm_id || '').trim() ||
        pickQueryParam(sampleUrl, ['utm_id', 'tid', 'uid']),
      sampleUrl,
    })
  }
  return out
}

async function loadShortcutSessionFlags(): Promise<
  Array<{
    workspaceId: string
    sessionId: string
    usedCopy: boolean
    usedPaste: boolean
  }>
> {
  const rows = await queryJson<{
    workspace_id: string
    session_id: string
    used_copy: string | number | boolean
    used_paste: string | number | boolean
  }>(`
    SELECT
      toString(workspace_id) AS workspace_id,
      session_id,
      max(event_name = 'form_shortcut_copy') AS used_copy,
      max(event_name = 'form_shortcut_paste') AS used_paste
    FROM ${CLICKHOUSE_EVENTS_TABLE}
    WHERE event_name IN ('form_shortcut_copy', 'form_shortcut_paste')
      AND session_id != ''
    GROUP BY workspace_id, session_id
    ORDER BY max(created_at) DESC
    LIMIT ${SHORTCUT_LEADS_LIMIT * 3}
  `)

  const out: Array<{
    workspaceId: string
    sessionId: string
    usedCopy: boolean
    usedPaste: boolean
  }> = []
  for (const row of rows) {
    const workspaceId = String(row.workspace_id || '').trim()
    const sessionId = String(row.session_id || '').trim()
    if (!workspaceId || !sessionId) continue
    out.push({
      workspaceId,
      sessionId,
      usedCopy: Boolean(Number(row.used_copy)),
      usedPaste: Boolean(Number(row.used_paste)),
    })
  }
  return out
}

function leadRowFromSignal(
  row: LeadSessionSignalRow,
  meta: SessionMeta | undefined,
  fraud: LeadFraudAssessment | null,
): Omit<WarehouseShortcutLead, 'usedCopy' | 'usedPaste'> {
  const rawFields = extractRawFieldMap(row.props || '{}')
  const fields = normalizeLeadFields(rawFields)
  const email =
    pickLeadEmail(fields) ||
    (typeof fields.email === 'string' ? fields.email : '')
  return {
    workspaceId: row.workspaceId,
    sessionId: row.sessionId,
    macId: formatFingerprintAsMacId(row.fingerprint || ''),
    createdAt: meta?.createdAt || '',
    submittedAt: meta?.submittedAt ?? null,
    zip: (row.zipVal || pickLeadZip(fields) || '').trim(),
    email,
    firstName: (fields.first_name || '').trim(),
    lastName: (fields.last_name || '').trim(),
    utmSource: meta?.utmSource || '',
    utmId: meta?.utmId || '',
    trustedFormUrl: pickTrustedFormUrl(rawFields),
    formSubmitted: row.formSubmitted,
    fields: fieldsWithoutReserved(fields),
    fraud,
  }
}

async function buildShortcutLeads(
  assessmentByKey: Map<string, LeadFraudAssessment>,
): Promise<WarehouseShortcutLead[]> {
  let flags: Array<{
    workspaceId: string
    sessionId: string
    usedCopy: boolean
    usedPaste: boolean
  }> = []
  try {
    flags = await loadShortcutSessionFlags()
  } catch (err) {
    console.error('[warehouse] shortcut sessions failed', err)
    return []
  }
  if (flags.length === 0) return []

  const sessionIds = flags.map((row) => row.sessionId)
  const [leadRows, metaByKey] = await Promise.all([
    loadLeadSessionSignals({ sessionIds }),
    loadSessionMetaByKey(sessionIds).catch((err) => {
      console.error('[warehouse] shortcut lead meta failed', err)
      return new Map<string, SessionMeta>()
    }),
  ])

  const leadByKey = new Map<string, LeadSessionSignalRow>()
  for (const row of leadRows) {
    leadByKey.set(`${row.workspaceId}:${row.sessionId}`, row)
  }

  const leads: WarehouseShortcutLead[] = []
  for (const flag of flags) {
    const key = `${flag.workspaceId}:${flag.sessionId}`
    const row = leadByKey.get(key)
    if (!row) continue
    const base = leadRowFromSignal(
      row,
      metaByKey.get(key),
      assessmentByKey.get(key) ?? null,
    )
    leads.push({
      ...base,
      usedCopy: flag.usedCopy,
      usedPaste: flag.usedPaste,
    })
    if (leads.length >= SHORTCUT_LEADS_LIMIT) break
  }

  leads.sort((a, b) => {
    const at = a.createdAt || ''
    const bt = b.createdAt || ''
    if (at === bt) return a.sessionId.localeCompare(b.sessionId)
    return bt.localeCompare(at)
  })
  return leads
}

async function buildFraudLeads(
  leadRows: LeadSessionSignalRow[],
  assessmentByKey: Map<string, LeadFraudAssessment>,
): Promise<WarehouseFraudLead[]> {
  const fraudRows = leadRows.filter((row) => {
    const key = `${row.workspaceId}:${row.sessionId}`
    return assessmentByKey.get(key)?.effectiveLabel === 'fraud'
  })
  if (fraudRows.length === 0) return []

  let metaByKey = new Map<string, SessionMeta>()
  try {
    metaByKey = await loadSessionMetaByKey(
      fraudRows.map((row) => row.sessionId),
    )
  } catch (err) {
    console.error('[warehouse] fraud lead meta failed', err)
  }

  const leads: WarehouseFraudLead[] = []
  for (const row of fraudRows) {
    const key = `${row.workspaceId}:${row.sessionId}`
    const fraud = assessmentByKey.get(key)
    if (!fraud) continue
    const base = leadRowFromSignal(row, metaByKey.get(key), fraud)
    leads.push({
      ...base,
      fraud,
    })
  }

  leads.sort((a, b) => {
    const at = a.createdAt || ''
    const bt = b.createdAt || ''
    if (at === bt) return a.sessionId.localeCompare(b.sessionId)
    return bt.localeCompare(at)
  })
  return leads.slice(0, FRAUD_LEADS_LIMIT)
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

/**
 * Classify every lead/form-submit session with the same field-signal scorer
 * Data Leads uses, so Legit/Fraud totals and per-lead badges stay aligned.
 */
async function loadWarehouseLeadInsights(): Promise<WarehouseLeadInsights> {
  const ch = getClickHouseClient()
  const leadRows = await loadLeadSessionSignals()

  const riskRes = await ch.query({
    format: 'JSON',
    query: `
      SELECT
        toString(workspace_id) AS workspace_id,
        session_id,
        score,
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
        score: string | number
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
      assessment: LeadFraudAssessment
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
    const reasons = parseReasonsJson(row.reasons)
    existingRisk.set(`${wid}:${sid}`, {
      label,
      modelVersion: String(row.model_version || ''),
      email,
      assessment: {
        score: n(row.score),
        label,
        effectiveLabel: label,
        reasons,
        modelVersion: String(row.model_version || ''),
      },
    })
  }

  const labelByKey = new Map<string, 'legit' | 'fraud'>()
  const emailByKey = new Map<string, string>()
  const assessmentByKey = new Map<string, LeadFraudAssessment>()
  const fraudReasonCounts = new Map<string, number>()
  const needsScore = leadRows.filter((row) => {
    const key = `${row.workspaceId}:${row.sessionId}`
    const existing = existingRisk.get(key)
    return !(existing && existing.modelVersion === LEAD_FRAUD_MODEL_VERSION)
  })

  function addFraudReasons(reasons: string[]) {
    for (const reason of reasons) {
      const key = normalizeFraudReason(reason)
      if (!key) continue
      fraudReasonCounts.set(key, (fraudReasonCounts.get(key) ?? 0) + 1)
    }
  }

  for (const row of leadRows) {
    const key = `${row.workspaceId}:${row.sessionId}`
    const existing = existingRisk.get(key)
    if (existing && existing.modelVersion === LEAD_FRAUD_MODEL_VERSION) {
      labelByKey.set(key, existing.label)
      assessmentByKey.set(key, existing.assessment)
      const email =
        existing.email.includes('@')
          ? existing.email
          : pickLeadEmail(
              normalizeLeadFields(extractRawFieldMap(row.props || '{}')),
            )
      if (email.includes('@')) emailByKey.set(key, email)
      if (existing.label === 'fraud') addFraudReasons(existing.assessment.reasons)
    }
  }

  const toPersist: Array<{
    workspaceId: string
    sessionId: string
    assessment: LeadFraudAssessment
    features: LeadFraudFeatures
  }> = []

  if (needsScore.length > 0) {
    const classified = classifyLeadSessionRows(leadRows)
    const needKeys = new Set(
      needsScore.map((row) => `${row.workspaceId}:${row.sessionId}`),
    )
    for (const item of classified.toPersist) {
      const key = `${item.workspaceId}:${item.sessionId}`
      if (!needKeys.has(key)) continue
      labelByKey.set(key, item.assessment.label)
      assessmentByKey.set(key, item.assessment)
      if (item.features.email.includes('@')) {
        emailByKey.set(key, item.features.email)
      }
      if (item.assessment.label === 'fraud') {
        addFraudReasons(item.assessment.reasons)
      }
      toPersist.push(item)
    }
  }

  if (toPersist.length > 0) {
    void upsertLeadRiskBatch(toPersist).catch(() => {
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
  const failed = Math.max(0, needsScore.length - toPersist.length)
  const [fraudLeads, shortcutLeads] = await Promise.all([
    buildFraudLeads(leadRows, assessmentByKey),
    buildShortcutLeads(assessmentByKey),
  ])
  return {
    risk: {
      legit,
      fraud,
      unscoredFormSubmits: failed,
    },
    scoredLeads,
    emailDomains,
    fraudReasons,
    fraudLeads,
    shortcutLeads,
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
    shortcuts: {
      formSessions: 0,
      byName: SHORTCUT_ROWS.map((row) => ({
        name: row.name,
        label: row.label,
        sessions: 0,
        percent: 0,
      })),
    },
    eventsByName: [],
    emailDomains: [],
    fraudReasons: [],
    fraudLeads: [],
    shortcutLeads: [],
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
      fraudLeads: [],
      shortcutLeads: [],
    }
  }

  const [totalsRows, volumeRows, eventNameRows, clickRows, shortcutRows, pg] =
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
      queryJson<{
        form_sessions: string | number
        copy_sessions: string | number
        paste_sessions: string | number
      }>(`
      SELECT
        uniqExactIf(session_id, event_name = 'form_start') AS form_sessions,
        uniqExactIf(session_id, event_name = 'form_shortcut_copy') AS copy_sessions,
        uniqExactIf(session_id, event_name = 'form_shortcut_paste') AS paste_sessions
      FROM ${CLICKHOUSE_EVENTS_TABLE}
    `),
      loadPostgresTotals().catch(() => ({
        landingPages: 0,
        workspaces: 0,
        users: 0,
      })),
    ])

  const totalsRow = totalsRows[0]
  const volumeRow = volumeRows[0]
  const shortcutRow = shortcutRows[0]
  const formSessions = n(shortcutRow?.form_sessions)
  const shortcutCounts: Record<string, number> = {
    form_shortcut_copy: n(shortcutRow?.copy_sessions),
    form_shortcut_paste: n(shortcutRow?.paste_sessions),
  }

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
    shortcuts: {
      formSessions,
      byName: SHORTCUT_ROWS.map((row) => {
        const sessions = shortcutCounts[row.name] ?? 0
        return {
          name: row.name,
          label: row.label,
          sessions,
          percent: shortcutPercent(sessions, formSessions),
        }
      }),
    },
    eventsByName: eventNameRows.map((row) => ({
      name: row.event_name || '(empty)',
      count: n(row.c),
    })),
    emailDomains: leadInsights.emailDomains,
    fraudReasons: leadInsights.fraudReasons,
    fraudLeads: leadInsights.fraudLeads,
    shortcutLeads: leadInsights.shortcutLeads,
    generatedAt,
  }
}
