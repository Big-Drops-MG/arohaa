import { CLICKHOUSE_EVENTS_TABLE } from '../clickhouse-events-table.js'
import { getClickHouseClient } from '../../services/clickhouse.service.js'
import { loadSessionShadowEvidence } from './session-evidence-load.js'
import { upsertVisitRisk } from './visit-persist.js'
import {
  emptyVisitSignals,
  scoreVisit,
  type VisitAssessment,
} from './visit-score.js'

export class VisitAssessNotReadyError extends Error {
  readonly code: string

  constructor(code: string, message?: string) {
    super(message ?? code)
    this.name = 'VisitAssessNotReadyError'
    this.code = code
  }
}

type Pending = {
  workspaceId: string
  sessionId: string
  tenantWorkspaceId?: string
}

export async function isSessionEventPersisted(input: {
  workspaceId: string
  sessionId: string
  eventId: string
}): Promise<boolean> {
  const workspaceId = input.workspaceId.trim()
  const sessionId = input.sessionId.trim()
  const eventId = input.eventId.trim()
  if (!workspaceId || !sessionId || !eventId) return false
  try {
    const ch = getClickHouseClient()
    const res = await ch.query({
      query: `
        SELECT 1 AS ok
        FROM ${CLICKHOUSE_EVENTS_TABLE}
        WHERE workspace_id = {workspaceId:UUID}
          AND session_id = {sessionId:String}
          AND event_id = {eventId:String}
        LIMIT 1
      `,
      query_params: { workspaceId, sessionId, eventId },
      format: 'JSON',
    })
    const json = (await res.json()) as { data: Array<{ ok: string | number }> }
    return (json.data?.length ?? 0) > 0
  } catch {
    return false
  }
}

function keyOf(workspaceId: string, sessionId: string): string {
  return `${workspaceId}:${sessionId}`
}

async function loadArrivalStats(input: {
  workspaceId: string
  fingerprint: string
  clientIpHash: string
}): Promise<
  | {
      ok: true
      arrivalCount24h: number
      lowEngagementRepeatCount: number
    }
  | { ok: false }
> {
  if (!input.fingerprint && !input.clientIpHash) {
    return { ok: true, arrivalCount24h: 0, lowEngagementRepeatCount: 0 }
  }
  try {
    const ch = getClickHouseClient()
    const res = await ch.query({
      query: `
        SELECT
          uniqExact(session_id) AS arrivals,
          uniqExactIf(
            session_id,
            session_id NOT IN (
              SELECT DISTINCT session_id
              FROM ${CLICKHOUSE_EVENTS_TABLE}
              WHERE workspace_id = {workspaceId:UUID}
                AND created_at >= now() - INTERVAL 24 HOUR
                AND (
                  event_name IN (
                    'form_start', 'form_submit', 'form_success',
                    'button_click', 'link_click', 'scroll_depth'
                  )
                  OR (
                    event_name = 'behavior_summary'
                    AND (
                      JSONExtractInt(properties, 'focus_count') > 0
                      OR JSONExtractInt(properties, 'input_count') > 0
                      OR JSONExtractInt(properties, 'pointer_count') > 0
                      OR JSONExtractInt(properties, 'keyboard_count') > 0
                    )
                  )
                )
            )
          ) AS low_engagement
        FROM ${CLICKHOUSE_EVENTS_TABLE}
        WHERE workspace_id = {workspaceId:UUID}
          AND created_at >= now() - INTERVAL 24 HOUR
          AND event_name = 'page_view'
          AND (
            ({fingerprint:String} != '' AND fingerprint = {fingerprint:String})
            OR ({ipHash:String} != '' AND client_ip_hash = {ipHash:String})
          )
      `,
      query_params: {
        workspaceId: input.workspaceId,
        fingerprint: input.fingerprint,
        ipHash: input.clientIpHash,
      },
      format: 'JSON',
    })
    const json = (await res.json()) as {
      data: Array<{ arrivals: string | number; low_engagement: string | number }>
    }
    const row = json.data?.[0]
    return {
      ok: true,
      arrivalCount24h: Number(row?.arrivals ?? 0) || 0,
      lowEngagementRepeatCount: Number(row?.low_engagement ?? 0) || 0,
    }
  } catch {
    return { ok: false }
  }
}

async function loadSimilarBehaviorCount(input: {
  workspaceId: string
  sessionId: string
  behaviorFingerprint: string
}): Promise<{ ok: true; count: number } | { ok: false }> {
  if (!input.behaviorFingerprint) return { ok: true, count: 0 }
  try {
    const ch = getClickHouseClient()
    const res = await ch.query({
      query: `
        SELECT uniqExact(session_id) AS cnt
        FROM ${CLICKHOUSE_EVENTS_TABLE}
        WHERE workspace_id = {workspaceId:UUID}
          AND created_at >= now() - INTERVAL 24 HOUR
          AND event_name = 'behavior_summary'
          AND session_id != {sessionId:String}
          AND concat(
            toString(intDiv(JSONExtractInt(properties, 'visible_ms'), 5000)),
            ':',
            toString(intDiv(JSONExtractInt(properties, 'active_ms'), 5000)),
            ':',
            if(
              JSONExtractInt(properties, 'focus_count') > 0
              OR JSONExtractInt(properties, 'input_count') > 0
              OR JSONExtractInt(properties, 'pointer_count') > 0
              OR JSONExtractInt(properties, 'keyboard_count') > 0,
              '1',
              '0'
            )
          ) = {fp:String}
      `,
      query_params: {
        workspaceId: input.workspaceId,
        sessionId: input.sessionId,
        fp: input.behaviorFingerprint,
      },
      format: 'JSON',
    })
    const json = (await res.json()) as {
      data: Array<{ cnt: string | number }>
    }
    return { ok: true, count: Number(json.data?.[0]?.cnt ?? 0) || 0 }
  } catch {
    return { ok: false }
  }
}

function behaviorFingerprintFromEvidence(evidence: {
  hasMeaningfulInteraction: boolean
  visibleMs: number | null
  activeMs: number | null
}): string {
  if (evidence.visibleMs == null && evidence.activeMs == null) return ''
  const visibleBucket = Math.floor((evidence.visibleMs ?? 0) / 5000)
  const activeBucket = Math.floor((evidence.activeMs ?? 0) / 5000)
  const interact = evidence.hasMeaningfulInteraction ? 1 : 0
  return `${visibleBucket}:${activeBucket}:${interact}`
}

async function loadSessionIdentity(input: {
  workspaceId: string
  sessionId: string
}): Promise<
  | { ok: true; fingerprint: string; clientIpHash: string }
  | { ok: false }
> {
  try {
    const ch = getClickHouseClient()
    const res = await ch.query({
      query: `
        SELECT
          anyHeavy(fingerprint) AS fingerprint,
          anyHeavy(client_ip_hash) AS client_ip_hash
        FROM ${CLICKHOUSE_EVENTS_TABLE}
        WHERE workspace_id = {workspaceId:UUID}
          AND session_id = {sessionId:String}
        LIMIT 1
      `,
      query_params: {
        workspaceId: input.workspaceId,
        sessionId: input.sessionId,
      },
      format: 'JSON',
    })
    const json = (await res.json()) as {
      data: Array<{ fingerprint: string; client_ip_hash: string }>
    }
    const row = json.data?.[0]
    if (!row) return { ok: true, fingerprint: '', clientIpHash: '' }
    return {
      ok: true,
      fingerprint: String(row.fingerprint || ''),
      clientIpHash: String(row.client_ip_hash || ''),
    }
  } catch {
    return { ok: false }
  }
}

export async function ensureSessionVisitAssessment(input: {
  workspaceId: string
  sessionId: string
  tenantWorkspaceId?: string
  triggerEventId?: string
}): Promise<VisitAssessment> {
  const workspaceId = input.workspaceId.trim()
  const sessionId = input.sessionId.trim()
  const triggerEventId = input.triggerEventId?.trim()

  if (triggerEventId) {
    const ready = await isSessionEventPersisted({
      workspaceId,
      sessionId,
      eventId: triggerEventId,
    })
    if (!ready) {
      throw new VisitAssessNotReadyError(
        'trigger_event_pending',
        `Triggering event ${triggerEventId} is not yet visible in ClickHouse`,
      )
    }
  }

  const evidence = await loadSessionShadowEvidence({ workspaceId, sessionId })
  const identity = await loadSessionIdentity({ workspaceId, sessionId })
  const arrivals =
    identity.ok
      ? await loadArrivalStats({
          workspaceId,
          fingerprint: identity.fingerprint,
          clientIpHash: identity.clientIpHash,
        })
      : ({ ok: false } as const)

  const signalsIncomplete =
    evidence.eventCount === 0 ||
    (!evidence.sdkVersion &&
      evidence.visibleMs == null &&
      evidence.integrityFindings.length === 0 &&
      evidence.browserFindings.length === 0)

  const behaviorFp = behaviorFingerprintFromEvidence(evidence)
  const similar =
    behaviorFp.length > 0
      ? await loadSimilarBehaviorCount({
          workspaceId,
          sessionId,
          behaviorFingerprint: behaviorFp,
        })
      : ({ ok: true, count: 0 } as const)

  const assessment = scoreVisit(
    emptyVisitSignals({
      sessionId,
      workspaceId,
      tenantWorkspaceId: input.tenantWorkspaceId ?? '',
      arrivedAtMs: evidence.arrivedAtMs,
      departedAtMs: evidence.departedAtMs,
      visibleMs: evidence.visibleMs,
      activeMs: evidence.activeMs,
      hasMeaningfulInteraction: evidence.hasMeaningfulInteraction,
      hasFormEngagement: evidence.hasFormEngagement,
      formSubmitted: evidence.formSubmitted,
      arrivalCount24h: arrivals.ok ? arrivals.arrivalCount24h : null,
      lowEngagementRepeatCount: arrivals.ok
        ? arrivals.lowEngagementRepeatCount
        : null,
      similarBehaviorRepeatCount: similar.ok ? similar.count : null,
      similarBehaviorAvailable: similar.ok && behaviorFp.length > 0,
      arrivalStatsAvailable: arrivals.ok,
      identityAvailable: identity.ok,
      sdkVersion: evidence.sdkVersion,
      sdkCapabilities: evidence.sdkCapabilities,
      integrityFindings: evidence.integrityFindings,
      browserFindings: [
        ...evidence.browserFindings,
        ...evidence.pageIntegrityFindings,
      ],
      signalsIncomplete,
      evidenceTruncated: evidence.evidenceTruncated,
    }),
  )

  await upsertVisitRisk({
    workspaceId,
    sessionId,
    tenantWorkspaceId: input.tenantWorkspaceId,
    sdkVersion: evidence.sdkVersion,
    sdkCapabilities: evidence.sdkCapabilities,
    assessment,
  })

  return assessment
}

export async function ensureVisitAssessments(
  inputs: Pending[],
): Promise<Map<string, VisitAssessment>> {
  const out = new Map<string, VisitAssessment>()
  const unique = new Map<string, Pending>()
  for (const item of inputs) {
    const workspaceId = item.workspaceId.trim()
    const sessionId = item.sessionId.trim()
    if (!workspaceId || !sessionId) continue
    unique.set(keyOf(workspaceId, sessionId), {
      workspaceId,
      sessionId,
      tenantWorkspaceId: item.tenantWorkspaceId,
    })
  }
  for (const item of unique.values()) {
    try {
      const assessment = await ensureSessionVisitAssessment(item)
      out.set(keyOf(item.workspaceId, item.sessionId), assessment)
    } catch (err) {
      console.error('[visit-fraud] ensureSessionVisitAssessment failed', err)
    }
  }
  return out
}
