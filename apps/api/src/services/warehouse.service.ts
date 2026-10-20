import {
  readAnalyticsCache,
  writeAnalyticsCache,
} from '../lib/analytics-cache.js'
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
  decryptJsonBlob,
  FI_EVENT_NAME,
  OPAQUE_PROP_KEY,
} from '../lib/field-blob.js'
import { detectClipboardFromFiPayload } from '../lib/fi-clipboard.js'
import {
  extractFieldsFromFiPayload,
  mergeFieldMaps,
} from '../lib/fi-field-extract.js'
import {
  extractRawFieldMap,
  type LeadSessionSignalRow,
} from '../lib/lead-fraud/field-signals.js'
import { loadLeadSessionSignals } from '../lib/lead-fraud/load-sessions.js'
import { upsertLeadRiskBatch } from '../lib/lead-fraud/persist.js'
import { classifyLeadSessionRows } from '../lib/lead-fraud/service.js'
import type { LeadFraudAssessment } from '../lib/lead-fraud/types.js'
import {
  getClickHouseClient,
  LEAD_RISK_TABLE,
  shouldSkipClickHouse,
} from './clickhouse.service.js'
import { and, eq, inArray } from 'drizzle-orm'
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
  workspaceName: string
  lpPublicId: string
  sessionId: string
  tenantWorkspaceId: string
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
  relatedCount: number
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
    elevatedRisk: number
    lowerRisk: number
    insufficientData: number
  }
  quality: {
    submissions: number
    flagged: number
    incompleteAssessments: number
    pendingReviews: number
    relatedContactGroups: number
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

export type WarehousePartnerScorecard = {
  partner: string
  submissions: number
  elevatedRisk: number
  incompleteAssessments: number
  reviewed: number
  wrongNumber: number
  neverRequested: number
  converted: number
}

const SHORTCUT_LEADS_LIMIT = 100
const FI_CLIPBOARD_SESSION_LIMIT = 4_000
const FI_CLIPBOARD_SCAN_LIMIT = 40_000
const WAREHOUSE_SUMMARY_CACHE_KEY = 'warehouse:summary:v8'
const WAREHOUSE_SUMMARY_CACHE_TTL_SEC = 90

type ShortcutSessionFlag = {
  workspaceId: string
  sessionId: string
  usedCopy: boolean
  usedPaste: boolean
  fiFields?: Record<string, string>
}

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
    elevatedRisk: number
    lowerRisk: number
    insufficientData: number
  }
  quality: {
    submissions: number
    flagged: number
    incompleteAssessments: number
    pendingReviews: number
    relatedContactGroups: number
  }
  scoredLeads: number
  emailDomains: WarehouseDomainCount[]
  fraudReasons: WarehouseNameCount[]
  fraudLeads: WarehouseFraudLead[]
  shortcutLeads: WarehouseShortcutLead[]
  shortcutCopySessions: number
  shortcutPasteSessions: number
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
        anyIf(utm_s1, utm_s1 != '') AS utm_s1,
        argMaxIf(url, (length(url), created_at), url != '') AS sample_url
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
        utm_s1: string
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
        String(row.utm_s1 || '').trim() ||
        pickQueryParam(sampleUrl, ['utm_source', 'sid', 's1']),
      utmId:
        String(row.utm_id || '').trim() ||
        pickQueryParam(sampleUrl, ['utm_id', 'tid', 'uid']),
      sampleUrl,
    })
  }
  return out
}

type LandingPageMeta = {
  projectName: string
  publicId: string
}

async function loadLandingPageMetaByIds(
  landingPageIds: string[],
): Promise<Map<string, LandingPageMeta>> {
  const ids = [
    ...new Set(landingPageIds.map((id) => id.trim()).filter(Boolean)),
  ]
  const out = new Map<string, LandingPageMeta>()
  if (ids.length === 0) return out

  try {
    const rows = await db
      .select({
        landingPageId: landingPages.id,
        publicId: landingPages.publicId,
        brandName: landingPages.brandName,
        workspaceName: workspaces.name,
      })
      .from(landingPages)
      .innerJoin(workspaces, eq(landingPages.workspaceId, workspaces.id))
      .where(
        and(inArray(landingPages.id, ids), isNull(landingPages.deletedAt)),
      )

    for (const row of rows) {
      const projectName = (row.brandName || row.workspaceName || '').trim()
      out.set(row.landingPageId, {
        projectName,
        publicId: (row.publicId || '').trim(),
      })
    }
  } catch (err) {
    console.error('[warehouse] landing page meta lookup failed', err)
  }
  return out
}

function mergeShortcutFlags(
  into: Map<string, ShortcutSessionFlag>,
  flag: ShortcutSessionFlag,
): void {
  const key = `${flag.workspaceId}:${flag.sessionId}`
  const existing = into.get(key)
  if (!existing) {
    into.set(key, { ...flag })
    return
  }
  existing.usedCopy = existing.usedCopy || flag.usedCopy
  existing.usedPaste = existing.usedPaste || flag.usedPaste
  if (flag.fiFields && Object.keys(flag.fiFields).length > 0) {
    existing.fiFields = mergeFieldMaps(existing.fiFields, flag.fiFields)
  }
}

async function loadFirstClassShortcutFlags(): Promise<ShortcutSessionFlag[]> {
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

  const out: ShortcutSessionFlag[] = []
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


async function loadFiClipboardShortcutFlags(): Promise<ShortcutSessionFlag[]> {
  const ch = getClickHouseClient()
  const res = await ch.query({
    format: 'JSON',
    query_params: {
      lim: FI_CLIPBOARD_SCAN_LIMIT,
      sessionLim: FI_CLIPBOARD_SESSION_LIMIT,
      ev: FI_EVENT_NAME,
    },
    query: `
      WITH form_sessions AS (
        SELECT
          workspace_id,
          session_id
        FROM ${CLICKHOUSE_EVENTS_TABLE}
        WHERE event_name IN ('form_start', 'form_submit', 'form_success')
          AND session_id != ''
          AND created_at >= now() - INTERVAL 180 DAY
        GROUP BY workspace_id, session_id
        ORDER BY max(created_at) DESC
        LIMIT {sessionLim:UInt32}
      )
      SELECT
        toString(e.workspace_id) AS workspace_id,
        e.session_id AS session_id,
        e.properties AS properties
      FROM ${CLICKHOUSE_EVENTS_TABLE} AS e
      INNER JOIN form_sessions AS f
        ON e.workspace_id = f.workspace_id
       AND e.session_id = f.session_id
      WHERE e.event_name = {ev:String}
        AND e.created_at >= now() - INTERVAL 180 DAY
      ORDER BY e.created_at DESC
      LIMIT {lim:UInt32}
    `,
  })
  const rows =
    (
      (await res.json()) as CHJson<{
        workspace_id: string
        session_id: string
        properties: string
      }>
    ).data ?? []

  const byKey = new Map<string, ShortcutSessionFlag>()
  for (const row of rows) {
    const workspaceId = String(row.workspace_id || '').trim()
    const sessionId = String(row.session_id || '').trim()
    if (!workspaceId || !sessionId) continue
    try {
      const props = JSON.parse(row.properties || '{}') as Record<string, unknown>
      const blob = props[OPAQUE_PROP_KEY]
      if (typeof blob !== 'string' || !blob) continue
      const hit = detectClipboardFromFiPayload(decryptJsonBlob(blob))
      if (!hit.usedCopy && !hit.usedPaste) continue
      mergeShortcutFlags(byKey, {
        workspaceId,
        sessionId,
        usedCopy: hit.usedCopy,
        usedPaste: hit.usedPaste,
      })
    } catch {
      /* skip undecryptable batch */
    }
  }
  return [...byKey.values()]
}

async function loadFiDerivedFieldsBySessions(
  flags: ShortcutSessionFlag[],
): Promise<Map<string, Record<string, string>>> {
  const out = new Map<string, Record<string, string>>()
  const sids = [
    ...new Set(flags.map((f) => f.sessionId.trim()).filter(Boolean)),
  ]
  if (sids.length === 0) return out

  const ch = getClickHouseClient()
  const res = await ch.query({
    format: 'JSON',
    query_params: {
      sids,
      ev: FI_EVENT_NAME,
      lim: Math.min(20_000, Math.max(500, sids.length * 40)),
    },
    query: `
      SELECT
        toString(workspace_id) AS workspace_id,
        session_id,
        properties
      FROM ${CLICKHOUSE_EVENTS_TABLE}
      WHERE event_name = {ev:String}
        AND session_id IN {sids:Array(String)}
        AND created_at >= now() - INTERVAL 180 DAY
      ORDER BY created_at ASC
      LIMIT {lim:UInt32}
    `,
  })
  const rows =
    (
      (await res.json()) as CHJson<{
        workspace_id: string
        session_id: string
        properties: string
      }>
    ).data ?? []

  for (const row of rows) {
    const workspaceId = String(row.workspace_id || '').trim()
    const sessionId = String(row.session_id || '').trim()
    if (!workspaceId || !sessionId) continue
    const key = `${workspaceId}:${sessionId}`
    try {
      const props = JSON.parse(row.properties || '{}') as Record<string, unknown>
      const blob = props[OPAQUE_PROP_KEY]
      if (typeof blob !== 'string' || !blob) continue
      const fields = extractFieldsFromFiPayload(decryptJsonBlob(blob))
      if (Object.keys(fields).length === 0) continue
      out.set(key, mergeFieldMaps(out.get(key), fields))
    } catch {
      /* skip */
    }
  }
  return out
}

async function loadShortcutSessionFlags(): Promise<{
  flags: ShortcutSessionFlag[]
  copySessions: number
  pasteSessions: number
}> {
  const [firstClass, fromFi] = await Promise.all([
    loadFirstClassShortcutFlags().catch((err) => {
      console.error('[warehouse] first-class shortcut sessions failed', err)
      return [] as ShortcutSessionFlag[]
    }),
    loadFiClipboardShortcutFlags().catch((err) => {
      console.error('[warehouse] FI clipboard scan failed', err)
      return [] as ShortcutSessionFlag[]
    }),
  ])

  const byKey = new Map<string, ShortcutSessionFlag>()
  for (const flag of [...fromFi, ...firstClass]) {
    mergeShortcutFlags(byKey, flag)
  }

  let flags = [...byKey.values()]
  if (flags.length > 0) {
    try {
      const fiFieldsByKey = await loadFiDerivedFieldsBySessions(flags)
      for (const flag of flags) {
        const key = `${flag.workspaceId}:${flag.sessionId}`
        const fiFields = fiFieldsByKey.get(key)
        if (fiFields && Object.keys(fiFields).length > 0) {
          flag.fiFields = mergeFieldMaps(flag.fiFields, fiFields)
        }
      }
    } catch (err) {
      console.error('[warehouse] FI field extract failed', err)
    }
  }

  let copySessions = 0
  let pasteSessions = 0
  for (const flag of byKey.values()) {
    if (flag.usedCopy) copySessions += 1
    if (flag.usedPaste) pasteSessions += 1
  }

  flags = [...byKey.values()].sort((a, b) =>
    a.sessionId.localeCompare(b.sessionId),
  )
  return { flags, copySessions, pasteSessions }
}

function leadRowFromSignal(
  row: LeadSessionSignalRow,
  meta: SessionMeta | undefined,
  fraud: LeadFraudAssessment | null,
  lpMeta: LandingPageMeta | undefined,
  fiFields?: Record<string, string>,
): Omit<WarehouseShortcutLead, 'usedCopy' | 'usedPaste'> {
  const rawFields = mergeFieldMaps(
    fiFields,
    extractRawFieldMap(row.props || '{}'),
  )
  const fields = normalizeLeadFields(rawFields)
  const email =
    pickLeadEmail(fields) ||
    (typeof fields.email === 'string' ? fields.email : '')
  return {
    workspaceId: row.workspaceId,
    workspaceName: lpMeta?.projectName || '',
    lpPublicId: lpMeta?.publicId || '',
    sessionId: row.sessionId,
    tenantWorkspaceId: row.tenantWorkspaceId || '',
    macId: formatFingerprintAsMacId(row.fingerprint || ''),
    createdAt: meta?.createdAt || '',
    submittedAt: meta?.submittedAt ?? null,
    zip: (pickLeadZip(fields) || '').trim(),
    email,
    firstName: (fields.first_name || '').trim(),
    lastName: (fields.last_name || '').trim(),
    utmSource: meta?.utmSource || row.utmSource || '',
    utmId: meta?.utmId || '',
    trustedFormUrl: pickTrustedFormUrl(rawFields),
    formSubmitted: row.formSubmitted,
    fields: fieldsWithoutReserved(fields),
    fraud,
    relatedCount: 0,
  }
}

async function buildShortcutLeads(
  assessmentByKey: Map<string, LeadFraudAssessment>,
): Promise<{
  leads: WarehouseShortcutLead[]
  copySessions: number
  pasteSessions: number
}> {
  let discovery = {
    flags: [] as ShortcutSessionFlag[],
    copySessions: 0,
    pasteSessions: 0,
  }
  try {
    discovery = await loadShortcutSessionFlags()
  } catch (err) {
    console.error('[warehouse] shortcut sessions failed', err)
    return { leads: [], copySessions: 0, pasteSessions: 0 }
  }
  if (discovery.flags.length === 0) {
    return {
      leads: [],
      copySessions: discovery.copySessions,
      pasteSessions: discovery.pasteSessions,
    }
  }

  const sessionIds = discovery.flags.map((row) => row.sessionId)
  const landingPageIds = discovery.flags.map((row) => row.workspaceId)
  const [leadRows, metaByKey, lpMetaById] = await Promise.all([
    loadLeadSessionSignals({ sessionIds }),
    loadSessionMetaByKey(sessionIds).catch((err) => {
      console.error('[warehouse] shortcut lead meta failed', err)
      return new Map<string, SessionMeta>()
    }),
    loadLandingPageMetaByIds(landingPageIds),
  ])

  const leadByKey = new Map<string, LeadSessionSignalRow>()
  for (const row of leadRows) {
    leadByKey.set(`${row.workspaceId}:${row.sessionId}`, row)
  }

  const leads: WarehouseShortcutLead[] = []
  for (const flag of discovery.flags) {
    const key = `${flag.workspaceId}:${flag.sessionId}`
    const row = leadByKey.get(key)
    const meta = metaByKey.get(key)
    const lpMeta = lpMetaById.get(flag.workspaceId)
    if (row) {
      const base = leadRowFromSignal(
        row,
        meta,
        assessmentByKey.get(key) ?? null,
        lpMeta,
        flag.fiFields,
      )
      leads.push({
        ...base,
        usedCopy: flag.usedCopy,
        usedPaste: flag.usedPaste,
      })
    } else {
      const rawFields = mergeFieldMaps(flag.fiFields)
      const fields = normalizeLeadFields(rawFields)
      leads.push({
        workspaceId: flag.workspaceId,
        workspaceName: lpMeta?.projectName || '',
        lpPublicId: lpMeta?.publicId || '',
        sessionId: flag.sessionId,
        tenantWorkspaceId: '',
        macId: '',
        createdAt: meta?.createdAt || '',
        submittedAt: meta?.submittedAt ?? null,
        zip: pickLeadZip(fields),
        email: pickLeadEmail(fields),
        firstName: (fields.first_name || '').trim(),
        lastName: (fields.last_name || '').trim(),
        utmSource: meta?.utmSource || '',
        utmId: meta?.utmId || '',
        trustedFormUrl: pickTrustedFormUrl(rawFields),
        formSubmitted: Boolean(meta?.submittedAt),
        usedCopy: flag.usedCopy,
        usedPaste: flag.usedPaste,
        fields: fieldsWithoutReserved(fields),
        fraud: assessmentByKey.get(key) ?? null,
        relatedCount: 0,
      })
    }
    if (leads.length >= SHORTCUT_LEADS_LIMIT) break
  }

  leads.sort((a, b) => {
    const at = a.createdAt || ''
    const bt = b.createdAt || ''
    if (at === bt) return a.sessionId.localeCompare(b.sessionId)
    return bt.localeCompare(at)
  })
  return {
    leads,
    copySessions: discovery.copySessions,
    pasteSessions: discovery.pasteSessions,
  }
}


function scheduleWarehouseLeadRescore(
  existingRisk: Map<string, { modelVersion: string }>,
): void {
  void (async () => {
    try {
      const leadRows = await loadLeadSessionSignals()
      const needsScore = leadRows.filter((row) => {
        const key = `${row.workspaceId}:${row.sessionId}`
        const existing = existingRisk.get(key)
        return !(existing && existing.modelVersion === LEAD_FRAUD_MODEL_VERSION)
      })
      if (needsScore.length === 0) return
      const classified = await classifyLeadSessionRows(leadRows)
      const needKeys = new Set(
        needsScore.map((row) => `${row.workspaceId}:${row.sessionId}`),
      )
      const toPersist = classified.toPersist.filter((item) =>
        needKeys.has(`${item.workspaceId}:${item.sessionId}`),
      )
      if (toPersist.length > 0) {
        await upsertLeadRiskBatch(toPersist)
      }
    } catch (err) {
      console.error('[warehouse] background lead rescore failed', err)
    }
  })()
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


async function loadWarehouseLeadInsights(): Promise<WarehouseLeadInsights> {
  const ch = getClickHouseClient()

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
    let coverage: LeadFraudAssessment['coverage'] = 'partial'
    let findings: LeadFraudAssessment['findings'] = []
    try {
      const parsed = JSON.parse(row.features_json || '{}') as {
        coverage?: unknown
        findings?: unknown
      }
      if (
        parsed.coverage === 'sufficient' ||
        parsed.coverage === 'partial' ||
        parsed.coverage === 'insufficient'
      ) {
        coverage = parsed.coverage
      }
      if (Array.isArray(parsed.findings)) {
        findings = parsed.findings.filter(
          (f): f is { code: string; detail: string } =>
            Boolean(
              f &&
                typeof f === 'object' &&
                typeof (f as { code?: unknown }).code === 'string' &&
                typeof (f as { detail?: unknown }).detail === 'string',
            ),
        )
      }
    } catch {
      /* ignore */
    }
    const scoreAvailable = coverage !== 'insufficient'
    existingRisk.set(`${wid}:${sid}`, {
      label,
      modelVersion: String(row.model_version || ''),
      email,
      assessment: {
        score: scoreAvailable ? n(row.score) : null,
        scoreAvailable,
        label,
        effectiveLabel: label,
        coverage,
        findings,
        reasons,
        modelVersion: String(row.model_version || ''),
      },
    })
  }

  const labelByKey = new Map<string, 'legit' | 'fraud'>()
  const emailByKey = new Map<string, string>()
  const assessmentByKey = new Map<string, LeadFraudAssessment>()
  const fraudReasonCounts = new Map<string, number>()

  for (const [key, existing] of existingRisk) {
    if (existing.modelVersion !== LEAD_FRAUD_MODEL_VERSION) continue
    labelByKey.set(key, existing.label)
    assessmentByKey.set(key, existing.assessment)
    if (existing.email.includes('@')) emailByKey.set(key, existing.email)
    if (existing.label === 'fraud') {
      for (const reason of existing.assessment.reasons) {
        const normalized = normalizeFraudReason(reason)
        if (!normalized) continue
        fraudReasonCounts.set(
          normalized,
          (fraudReasonCounts.get(normalized) ?? 0) + 1,
        )
      }
    }
  }

  scheduleWarehouseLeadRescore(existingRisk)

  let legit = 0
  let fraud = 0
  let elevatedRisk = 0
  let lowerRisk = 0
  let insufficientData = 0
  for (const [key, label] of labelByKey) {
    const assessment = assessmentByKey.get(key)
    if (assessment && !assessment.scoreAvailable) {
      insufficientData += 1
    } else if (label === 'legit') {
      legit += 1
      lowerRisk += 1
    } else {
      fraud += 1
      elevatedRisk += 1
    }
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

  const shortcutDiscovery = await buildShortcutLeads(assessmentByKey)
  let pendingReviews = 0
  let relatedContactGroups = 0
  try {
    const { countPendingReviews } = await import(
      '../lib/lead-fraud/lead-review.js'
    )
    pendingReviews = (await countPendingReviews()).pending
  } catch {
    pendingReviews = 0
  }
  try {
    const { LEAD_CONTACT_KEYS_TABLE: keysTable } = await import(
      './clickhouse.service.js'
    )
    const groupRes = await ch.query({
      format: 'JSON',
      query: `
        SELECT uniqExact((tenant_workspace_id, key_type, key_hash)) AS groups
        FROM ${keysTable} FINAL
        WHERE tenant_workspace_id != ''
      `,
    })
    relatedContactGroups =
      Number(
        ((await groupRes.json()) as CHJson<{ groups: string }>).data?.[0]
          ?.groups ?? 0,
      ) || 0
  } catch {
    relatedContactGroups = 0
  }

  return {
    risk: {
      legit,
      fraud,
      unscoredFormSubmits: 0,
      elevatedRisk,
      lowerRisk,
      insufficientData,
    },
    quality: {
      submissions: legit + fraud + insufficientData,
      flagged: elevatedRisk,
      incompleteAssessments: insufficientData,
      pendingReviews,
      relatedContactGroups,
    },
    scoredLeads: legit + fraud + insufficientData,
    emailDomains,
    fraudReasons,
    fraudLeads: [],
    shortcutLeads: shortcutDiscovery.leads,
    shortcutCopySessions: shortcutDiscovery.copySessions,
    shortcutPasteSessions: shortcutDiscovery.pasteSessions,
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
    risk: {
      legit: 0,
      fraud: 0,
      unscoredFormSubmits: 0,
      elevatedRisk: 0,
      lowerRisk: 0,
      insufficientData: 0,
    },
    quality: {
      submissions: 0,
      flagged: 0,
      incompleteAssessments: 0,
      pendingReviews: 0,
      relatedContactGroups: 0,
    },
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

function emptyLeadInsights(): WarehouseLeadInsights {
  return {
    risk: {
      legit: 0,
      fraud: 0,
      unscoredFormSubmits: 0,
      elevatedRisk: 0,
      lowerRisk: 0,
      insufficientData: 0,
    },
    quality: {
      submissions: 0,
      flagged: 0,
      incompleteAssessments: 0,
      pendingReviews: 0,
      relatedContactGroups: 0,
    },
    scoredLeads: 0,
    emailDomains: [],
    fraudReasons: [],
    fraudLeads: [],
    shortcutLeads: [],
    shortcutCopySessions: 0,
    shortcutPasteSessions: 0,
  }
}

export async function getWarehouseSummary(): Promise<WarehouseSummary> {
  const generatedAt = new Date().toISOString()

  const cached = await readAnalyticsCache<WarehouseSummary>(
    WAREHOUSE_SUMMARY_CACHE_KEY,
  )
  if (cached) {
    return {
      ...cached,
      generatedAt: cached.generatedAt || generatedAt,
    }
  }

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
  const clickSet = new Set<string>(CLICK_EVENT_NAMES)

  const [leadInsightsResult, inventoryResult, eventNameRows, pg] =
    await Promise.all([
      loadWarehouseLeadInsights().catch((err) => {
        console.error('[warehouse] lead insights failed', err)
        return emptyLeadInsights()
      }),
      queryJson<{
        events: string | number
        sessions: string | number
        visitors: string | number
        workspaces_with_events: string | number
        form_starts: string | number
        form_submits: string | number
        form_successes: string | number
        click_events: string | number
        last_hour: string | number
        last_24h: string | number
        last_7d: string | number
        form_sessions: string | number
      }>(`
      SELECT
        count() AS events,
        uniqExact(session_id) AS sessions,
        uniqExact(if(user_id = '', fingerprint, user_id)) AS visitors,
        uniqExact(workspace_id) AS workspaces_with_events,
        countIf(event_name = 'form_start') AS form_starts,
        countIf(event_name = 'form_submit') AS form_submits,
        countIf(event_name = 'form_success') AS form_successes,
        countIf(event_name IN (${clickList})) AS click_events,
        countIf(created_at >= now() - INTERVAL 1 HOUR) AS last_hour,
        countIf(created_at >= now() - INTERVAL 24 HOUR) AS last_24h,
        countIf(created_at >= now() - INTERVAL 7 DAY) AS last_7d,
        uniqExactIf(session_id, event_name = 'form_start') AS form_sessions
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
      loadPostgresTotals().catch(() => ({
        landingPages: 0,
        workspaces: 0,
        users: 0,
      })),
    ])

  const leadInsights = leadInsightsResult
  const inventory = inventoryResult[0]
  const formSessions = n(inventory?.form_sessions)
  const shortcutCounts: Record<string, number> = {
    form_shortcut_copy: leadInsights.shortcutCopySessions,
    form_shortcut_paste: leadInsights.shortcutPasteSessions,
  }
  const eventsByName = eventNameRows.map((row) => ({
    name: row.event_name || '(empty)',
    count: n(row.c),
  }))
  const clicksByName = eventsByName.filter((row) => clickSet.has(row.name))

  const summary: WarehouseSummary = {
    totals: {
      events: n(inventory?.events),
      sessions: n(inventory?.sessions),
      visitors: n(inventory?.visitors),
      workspacesWithEvents: n(inventory?.workspaces_with_events),
      formStarts: n(inventory?.form_starts),
      formSubmits: n(inventory?.form_submits),
      formSuccesses: n(inventory?.form_successes),
      scoredLeads: leadInsights.scoredLeads,
      landingPages: pg.landingPages,
      workspaces: pg.workspaces,
      users: pg.users,
    },
    volume: {
      lastHour: n(inventory?.last_hour),
      last24h: n(inventory?.last_24h),
      last7d: n(inventory?.last_7d),
    },
    risk: leadInsights.risk,
    quality: leadInsights.quality,
    clicks: {
      total: n(inventory?.click_events),
      byName: clicksByName,
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
    eventsByName,
    emailDomains: leadInsights.emailDomains,
    fraudReasons: leadInsights.fraudReasons,
    fraudLeads: leadInsights.fraudLeads,
    shortcutLeads: leadInsights.shortcutLeads,
    generatedAt,
  }

  void writeAnalyticsCache(
    WAREHOUSE_SUMMARY_CACHE_KEY,
    summary,
    WAREHOUSE_SUMMARY_CACHE_TTL_SEC,
  )
  return summary
}

export async function getWarehousePartnerScorecards(): Promise<
  WarehousePartnerScorecard[]
> {
  const ch = getClickHouseClient()
  try {
    const { LEAD_CONTACT_KEYS_TABLE: keysTable, LEAD_REVIEW_TABLE: reviewTable } =
      await import('./clickhouse.service.js')
    const res = await ch.query({
      format: 'JSON',
      query: `
        SELECT
          if(k.utm_source = '', '(none)', k.utm_source) AS partner,
          uniqExact((k.landing_page_id, k.session_id)) AS submissions,
          countIf(r.review_status = 'reviewed') AS reviewed,
          countIf(r.call_outcome = 'wrong_number') AS wrong_number,
          countIf(r.call_outcome = 'never_requested') AS never_requested,
          countIf(r.call_outcome = 'converted') AS converted
        FROM ${keysTable} AS k FINAL
        LEFT JOIN ${reviewTable} AS r FINAL
          ON k.tenant_workspace_id = r.tenant_workspace_id
          AND k.session_id = r.session_id
        WHERE k.tenant_workspace_id != ''
        GROUP BY partner
        ORDER BY submissions DESC
        LIMIT 100
      `,
    })
    const rows =
      (
        (await res.json()) as CHJson<{
          partner: string
          submissions: string
          reviewed: string
          wrong_number: string
          never_requested: string
          converted: string
        }>
      ).data ?? []
    return rows.map((row) => ({
      partner: row.partner,
      submissions: n(row.submissions),
      elevatedRisk: 0,
      incompleteAssessments: 0,
      reviewed: n(row.reviewed),
      wrongNumber: n(row.wrong_number),
      neverRequested: n(row.never_requested),
      converted: n(row.converted),
    }))
  } catch (err) {
    console.error('[warehouse] partner scorecards failed', err)
    return []
  }
}
