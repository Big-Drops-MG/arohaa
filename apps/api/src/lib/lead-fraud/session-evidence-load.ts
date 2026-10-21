import { CLICKHOUSE_EVENTS_TABLE } from '../clickhouse-events-table.js'
import { getClickHouseClient } from '../../services/clickhouse.service.js'
import { findingsFromBrowserObservations } from './browser-consistency.js'
import {
  createFinding,
  parseAssessmentFindings,
  type AssessmentFinding,
} from './findings.js'
import { findingsFromPageIntegrity } from './page-integrity.js'
import { loadApprovedPageIntegrityBaseline } from './page-integrity-baseline.js'

type CHJson<T> = { data: T[] }

export const SESSION_EVIDENCE_EVENT_LIMIT = 500

export type SessionShadowEvidence = {
  integrityFindings: AssessmentFinding[]
  browserFindings: AssessmentFinding[]
  pageIntegrityFindings: AssessmentFinding[]
  sdkVersion: string
  sdkCapabilities: string
  visibleMs: number | null
  activeMs: number | null
  hasMeaningfulInteraction: boolean
  hasFormEngagement: boolean
  formSubmitted: boolean
  arrivedAtMs: number | null
  departedAtMs: number | null
  evidenceCutoffMs: number
  evidenceTruncated: boolean
  eventCount: number
  baselineVersion: number | null
  stableEvidenceKey: string
}

function parseProps(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function parseMs(raw: string): number {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return 0
  const normalized = trimmed.includes('T')
    ? trimmed
    : `${trimmed.replace(' ', 'T')}${trimmed.includes('Z') ? '' : 'Z'}`
  const ms = Date.parse(normalized)
  return Number.isFinite(ms) ? ms : 0
}

function dedupeFindings(findings: AssessmentFinding[]): AssessmentFinding[] {
  const seen = new Set<string>()
  const out: AssessmentFinding[] = []
  for (const f of findings) {
    const key = [
      f.code,
      f.detail,
      (f.evidenceRefs ?? []).join(','),
      f.availability,
      String(f.proposedScoreDelta ?? ''),
    ].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(f)
  }
  return out
}

function behaviorHasEngagement(props: Record<string, unknown>): boolean {
  const counts = [
    props.focus_count,
    props.input_count,
    props.change_count,
    props.selection_count,
    props.paste_count,
    props.pointer_count,
    props.touch_count,
    props.keyboard_count,
  ]
  return counts.some((v) => typeof v === 'number' && v > 0)
}

export async function loadSessionShadowEvidence(input: {
  workspaceId: string
  sessionId: string
}): Promise<SessionShadowEvidence> {
  const empty: SessionShadowEvidence = {
    integrityFindings: [],
    browserFindings: [],
    pageIntegrityFindings: [],
    sdkVersion: '',
    sdkCapabilities: '',
    visibleMs: null,
    activeMs: null,
    hasMeaningfulInteraction: false,
    hasFormEngagement: false,
    formSubmitted: false,
    arrivedAtMs: null,
    departedAtMs: null,
    evidenceCutoffMs: 0,
    evidenceTruncated: false,
    eventCount: 0,
    baselineVersion: null,
    stableEvidenceKey: 'empty',
  }

  const workspaceId = input.workspaceId.trim()
  const sessionId = input.sessionId.trim()
  if (!workspaceId || !sessionId) return empty

  const ch = getClickHouseClient()
  const [countRes, res] = await Promise.all([
    ch.query({
      query: `
        SELECT count() AS c
        FROM ${CLICKHOUSE_EVENTS_TABLE}
        WHERE workspace_id = {workspaceId:UUID}
          AND session_id = {sessionId:String}
      `,
      query_params: { workspaceId, sessionId },
      format: 'JSON',
    }),
    ch.query({
      query: `
        SELECT
          event_id,
          event_name,
          created_at,
          sdk_version,
          sdk_capabilities,
          integrity_json,
          properties,
          browser,
          os,
          device
        FROM ${CLICKHOUSE_EVENTS_TABLE}
        WHERE workspace_id = {workspaceId:UUID}
          AND session_id = {sessionId:String}
        ORDER BY created_at ASC, event_id ASC
        LIMIT {limit:UInt32}
      `,
      query_params: {
        workspaceId,
        sessionId,
        limit: SESSION_EVIDENCE_EVENT_LIMIT,
      },
      format: 'JSON',
    }),
  ])

  const totalEvents = Number(
    ((await countRes.json()) as CHJson<{ c: string | number }>).data?.[0]?.c ??
      0,
  )
  const rows =
    ((await res.json()) as CHJson<{
      event_id: string
      event_name: string
      created_at: string
      sdk_version: string
      sdk_capabilities: string
      integrity_json: string
      properties: string
      browser: string
      os: string
      device: string
    }>).data ?? []

  if (rows.length === 0) {
    return { ...empty, eventCount: totalEvents }
  }

  const evidenceTruncated = totalEvents > SESSION_EVIDENCE_EVENT_LIMIT
  const integrityFindings: AssessmentFinding[] = []
  let browserFindings: AssessmentFinding[] = []
  const pageIntegrityFindings: AssessmentFinding[] = []
  let browserObsSeen = false
  let pageIntegritySeen = false
  let visibleMs: number | null = null
  let activeMs: number | null = null
  let hasMeaningfulInteraction = false
  let hasFormEngagement = false
  let formSubmitted = false
  let sdkVersion = ''
  let sdkCapabilities = ''
  let arrivedAtMs: number | null = null
  let departedAtMs: number | null = null
  let evidenceCutoffMs = 0
  let baselineVersion: number | null = null
  const stableParts: string[] = []

  const baseline = await loadApprovedPageIntegrityBaseline(workspaceId)
  if (baseline.status === 'approved') {
    baselineVersion = baseline.baseline.version
  }

  for (const row of rows) {
    const at = parseMs(row.created_at)
    const eventKey = `${row.event_id || row.event_name}:${row.created_at}`
    if (at && (arrivedAtMs == null || at < arrivedAtMs)) arrivedAtMs = at
    if (at && at > evidenceCutoffMs) evidenceCutoffMs = at
    if (!sdkVersion && row.sdk_version) sdkVersion = row.sdk_version
    if (!sdkCapabilities && row.sdk_capabilities) {
      sdkCapabilities = row.sdk_capabilities
    }
    if (row.integrity_json && row.integrity_json !== '[]') {
      try {
        const parsed = parseAssessmentFindings(JSON.parse(row.integrity_json)).map(
          (f) => ({
            ...f,
            observedAt: f.observedAt || row.created_at,
            evidenceRefs: [...(f.evidenceRefs ?? []), row.event_id].filter(Boolean),
          }),
        )
        integrityFindings.push(...parsed)
        for (const f of parsed) {
          stableParts.push(`int:${f.code}:${row.event_id}`)
        }
      } catch {
        /* ignore */
      }
    }
    const props = parseProps(row.properties)
    if (row.event_name === 'sdk_connected' && props.browser_obs) {
      browserObsSeen = true
      browserFindings = findingsFromBrowserObservations({
        obs: props.browser_obs,
        serverBrowser: row.browser,
        serverOs: row.os,
        serverDevice: row.device,
      }).map((f) => ({
        ...f,
        observedAt: row.created_at,
        evidenceRefs: [row.event_id || eventKey],
      }))
      stableParts.push(`browser:${row.event_id}:${row.created_at}`)
    }
    if (row.event_name === 'page_integrity') {
      pageIntegritySeen = true
      if (baseline.status === 'not_assessed') {
        pageIntegrityFindings.push(
          createFinding({
            code: 'page_integrity_not_assessed',
            detail: `Page integrity not assessed: ${baseline.reason}`,
            subject: 'visit',
            severity: 'info',
            source: 'page_integrity',
            availability: 'unavailable',
            contributesToScore: false,
            shadow: true,
            observedAt: row.created_at,
            evidenceRefs: [row.event_id || eventKey],
          }),
        )
        stableParts.push(`pi:not_assessed:${baseline.reason}`)
      } else {
        const next = findingsFromPageIntegrity({
          props,
          baseline: baseline.baseline,
        }).map((f) => ({
          ...f,
          observedAt: row.created_at,
          evidenceRefs: [
            row.event_id || eventKey,
            `baseline:v${baseline.baseline.version}`,
          ],
          featureVersion: `baseline:v${baseline.baseline.version}`,
        }))
        pageIntegrityFindings.push(...next)
        for (const f of next) {
          stableParts.push(
            `pi:${f.code}:${row.event_id}:v${baseline.baseline.version}`,
          )
        }
      }
    }
    if (row.event_name === 'behavior_summary') {
      if (typeof props.visible_ms === 'number') visibleMs = props.visible_ms
      if (typeof props.active_ms === 'number') activeMs = props.active_ms
      if (behaviorHasEngagement(props)) hasMeaningfulInteraction = true
      if (props.form_start_at || props.form_submit_at) hasFormEngagement = true
      stableParts.push(`behavior:${row.event_id}:${row.created_at}`)
    }
    if (
      row.event_name === 'form_start' ||
      row.event_name === 'form_field_focus'
    ) {
      hasFormEngagement = true
    }
    if (
      row.event_name === 'button_click' ||
      row.event_name === 'link_click' ||
      row.event_name === 'scroll_depth'
    ) {
      hasMeaningfulInteraction = true
    }
    if (
      row.event_name === 'form_submit' ||
      row.event_name === 'form_success' ||
      row.event_name === 'zip_submit'
    ) {
      formSubmitted = true
      hasFormEngagement = true
    }
    if (row.event_name === 'page_leave' && at) departedAtMs = at
  }

  if (!browserObsSeen && sdkVersion) {
    browserFindings = findingsFromBrowserObservations({ obs: null }).map((f) => ({
      ...f,
      observedAt: 'browser:missing',
      evidenceRefs: ['browser:missing'],
    }))
    stableParts.push('browser:missing')
  }
  if (!pageIntegritySeen && sdkCapabilities.includes('page_integrity')) {
    pageIntegrityFindings.push(
      createFinding({
        code: 'page_integrity_not_assessed',
        detail: 'Page integrity observations were not received for this session',
        subject: 'visit',
        severity: 'info',
        source: 'page_integrity',
        availability: 'unavailable',
        contributesToScore: false,
        shadow: true,
        observedAt: 'pi:missing',
        evidenceRefs: ['pi:missing'],
      }),
    )
    stableParts.push('pi:missing')
  }

  if (evidenceTruncated) {
    stableParts.push(`truncated:${totalEvents}`)
  }

  return {
    integrityFindings: dedupeFindings(integrityFindings),
    browserFindings: dedupeFindings(browserFindings),
    pageIntegrityFindings: dedupeFindings(pageIntegrityFindings),
    sdkVersion,
    sdkCapabilities,
    visibleMs,
    activeMs,
    hasMeaningfulInteraction,
    hasFormEngagement,
    formSubmitted,
    arrivedAtMs,
    departedAtMs,
    evidenceCutoffMs,
    evidenceTruncated,
    eventCount: totalEvents,
    baselineVersion,
    stableEvidenceKey: stableParts.sort().join('|') || 'none',
  }
}
