import { createHash, randomUUID } from 'node:crypto'
import { redis } from '../services/redis.service.js'
import type { IngestEventBody } from '../types/event.js'
import { verifySessionToken } from './session-token.js'
import {
  createFinding,
  type AssessmentFinding,
} from './lead-fraud/findings.js'

const SEQ_TTL_SEC = 60 * 60 * 24
const CONTENT_PENDING_TTL_SEC = 90
const CONTENT_COMPLETE_TTL_SEC = 60 * 60 * 24 * 30
const CLOCK_SKEW_MS = 10 * 60_000
const FUTURE_SKEW_MS = 5 * 60_000

const CONTENT_PENDING = 'pending:'
const CONTENT_COMPLETE = 'complete:'

const CONTENT_COMPLETE_IF_OWNER_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("SET", KEYS[1], ARGV[2], "EX", tonumber(ARGV[3]))
end
return 0
`

const CONTENT_RELEASE_IF_OWNER_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`

const CONTENT_TAKEOVER_LUA = `
local cur = redis.call("GET", KEYS[1])
if (not cur) then
  redis.call("SET", KEYS[1], ARGV[1], "EX", tonumber(ARGV[2]))
  return "new"
end
local completePrefix = ARGV[3]
local pendingPrefix = ARGV[4]
local fingerprint = ARGV[5]
if cur == (completePrefix .. fingerprint) then
  return "same_complete"
end
if string.sub(cur, 1, #completePrefix) == completePrefix then
  return "conflict"
end
if string.sub(cur, 1, #pendingPrefix) == pendingPrefix then
  local sep = string.find(cur, "|", #pendingPrefix + 1, true)
  if not sep then
    return "conflict"
  end
  local fp = string.sub(cur, sep + 1)
  if fp ~= fingerprint then
    return "conflict"
  end
  if ARGV[6] == "1" then
    redis.call("SET", KEYS[1], ARGV[1], "EX", tonumber(ARGV[2]))
    return "reclaimed"
  end
  return "same_pending"
end
if cur == fingerprint then
  return "same_complete"
end
return "conflict"
`

export type ContentClaimResult =
  | { status: 'new'; ownerToken: string }
  | { status: 'reclaimed'; ownerToken: string }
  | { status: 'same_complete' }
  | { status: 'same_pending' }
  | { status: 'conflict' }
  | { status: 'unavailable' }

export type IntegrityResult = {
  findings: AssessmentFinding[]
  contentConflict: boolean
  idempotentReplay: boolean
  suppressCanonicalInsert: boolean
  conflictRecordProps: Record<string, unknown> | null
  contentFingerprint: string
  contentOwnerToken: string | null
}

function pendingContentValue(ownerToken: string, fingerprint: string): string {
  return `${CONTENT_PENDING}${ownerToken}|${fingerprint}`
}

function contentFingerprint(body: IngestEventBody): string {
  const stable = {
    ev: body.event_name ?? body.ev ?? '',
    wid: body.workspace_id ?? body.wid ?? '',
    sid: body.sid,
    uid: body.uid,
    lp_id: body.lp_id ?? '',
    ts: body.ts ?? 0,
    seq: body.seq ?? 0,
    props: body.props ?? {},
    utm_source: body.utm_source ?? '',
    utm_campaign: body.utm_campaign ?? '',
    utm_s1: body.utm_s1 ?? '',
  }
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex')
}

function contentKey(eventId: string): string {
  return `ingest:eid:body:${eventId.trim()}`
}

export async function claimContentFingerprint(
  eventId: string,
  fingerprint: string,
  opts?: { allowTakeover?: boolean },
): Promise<ContentClaimResult> {
  const key = contentKey(eventId)
  const ownerToken = randomUUID()
  const pendingValue = pendingContentValue(ownerToken, fingerprint)
  try {
    const claimed = await redis.set(
      key,
      pendingValue,
      'EX',
      CONTENT_PENDING_TTL_SEC,
      'NX',
    )
    if (claimed === 'OK') return { status: 'new', ownerToken }

    const outcome = (await redis.eval(
      CONTENT_TAKEOVER_LUA,
      1,
      key,
      pendingValue,
      String(CONTENT_PENDING_TTL_SEC),
      CONTENT_COMPLETE,
      CONTENT_PENDING,
      fingerprint,
      opts?.allowTakeover ? '1' : '0',
    )) as string

    if (outcome === 'new' || outcome === 'reclaimed') {
      return { status: outcome, ownerToken }
    }
    if (
      outcome === 'same_complete' ||
      outcome === 'same_pending' ||
      outcome === 'conflict'
    ) {
      return { status: outcome }
    }
    return { status: 'unavailable' }
  } catch {
    return { status: 'unavailable' }
  }
}

export async function markContentQueued(
  eventId: string,
  fingerprint: string,
  ownerToken: string,
): Promise<boolean> {
  const key = contentKey(eventId)
  try {
    const result = await redis.eval(
      CONTENT_COMPLETE_IF_OWNER_LUA,
      1,
      key,
      pendingContentValue(ownerToken, fingerprint),
      `${CONTENT_COMPLETE}${fingerprint}`,
      String(CONTENT_COMPLETE_TTL_SEC),
    )
    return result === 'OK' || result === 1
  } catch {
    return false
  }
}

export async function releaseContentClaim(
  eventId: string,
  ownerToken: string,
  fingerprint: string,
): Promise<boolean> {
  const key = contentKey(eventId)
  try {
    const result = await redis.eval(
      CONTENT_RELEASE_IF_OWNER_LUA,
      1,
      key,
      pendingContentValue(ownerToken, fingerprint),
    )
    return Number(result) === 1
  } catch {
    return false
  }
}

async function checkSequenceReuse(input: {
  sid: string
  lpId?: string
  seq: number | undefined
}): Promise<AssessmentFinding | null> {
  if (
    typeof input.seq !== 'number' ||
    !Number.isFinite(input.seq) ||
    input.seq <= 0
  ) {
    return null
  }
  const seq = Math.floor(input.seq)
  const scope = `${(input.lpId ?? '').trim() || '_'}:${input.sid.trim()}`
  const setKey = `ingest:seqset:${scope}`
  try {
    const added = await redis.sadd(setKey, String(seq))
    await redis.expire(setKey, SEQ_TTL_SEC)
    if (added === 0) {
      return createFinding({
        code: 'event_sequence_reuse',
        detail: `Session sequence ${seq} was reused for this page/session`,
        subject: 'visit',
        severity: 'medium',
        source: 'telemetry_integrity',
        availability: 'available',
        contributesToScore: false,
        shadow: true,
        proposedScoreDelta: 4,
      })
    }
  } catch {
    return createFinding({
      code: 'event_sequence_check_unavailable',
      detail: 'Sequence integrity check could not run',
      subject: 'visit',
      severity: 'info',
      source: 'telemetry_integrity',
      availability: 'unavailable',
      contributesToScore: false,
      shadow: true,
    })
  }
  return null
}

function timestampFindings(body: IngestEventBody): AssessmentFinding[] {
  const out: AssessmentFinding[] = []
  const clientTs =
    typeof body.ts === 'number' && Number.isFinite(body.ts) ? body.ts : null
  if (clientTs == null) {
    out.push(
      createFinding({
        code: 'client_timestamp_missing',
        detail: 'Client event timestamp was not provided',
        subject: 'visit',
        severity: 'info',
        source: 'telemetry_integrity',
        availability: 'unavailable',
        contributesToScore: false,
        shadow: true,
      }),
    )
    return out
  }
  const now = Date.now()
  if (clientTs > now + FUTURE_SKEW_MS) {
    out.push(
      createFinding({
        code: 'client_timestamp_implausible',
        detail: 'Client event time is unreasonably ahead of server receipt',
        subject: 'visit',
        severity: 'low',
        source: 'telemetry_integrity',
        availability: 'available',
        contributesToScore: false,
        shadow: true,
        proposedScoreDelta: 2,
      }),
    )
  } else if (now - clientTs > 24 * 60 * 60_000 + CLOCK_SKEW_MS) {
    out.push(
      createFinding({
        code: 'client_timestamp_stale',
        detail:
          'Client event time is much older than server receipt (retry or skew possible)',
        subject: 'visit',
        severity: 'info',
        source: 'telemetry_integrity',
        availability: 'available',
        contributesToScore: false,
        shadow: true,
      }),
    )
  }
  return out
}

function tokenFindings(body: IngestEventBody): AssessmentFinding[] {
  const wid = (body.workspace_id ?? body.wid ?? '').trim()
  const check = verifySessionToken(body.session_token, {
    wid,
    lpId: body.lp_id,
    sid: body.sid,
  })
  if (check.status === 'ok') return []
  if (check.status === 'unavailable') {
    return [
      createFinding({
        code: 'session_token_check_unavailable',
        detail:
          'Session token verification unavailable (signing secret not configured)',
        subject: 'visit',
        severity: 'info',
        source: 'telemetry_integrity',
        availability: 'unavailable',
        contributesToScore: false,
        shadow: true,
      }),
    ]
  }
  if (check.status === 'missing') {
    if (!body.sdk_version) return []
    return [
      createFinding({
        code: 'session_token_missing',
        detail: 'SDK reported a version but no session token was presented',
        subject: 'visit',
        severity: 'low',
        source: 'telemetry_integrity',
        availability: 'unavailable',
        contributesToScore: false,
        shadow: true,
      }),
    ]
  }
  if (check.status === 'expired') {
    return [
      createFinding({
        code: 'session_token_expired',
        detail: 'Session token was expired at receipt',
        subject: 'visit',
        severity: 'medium',
        source: 'telemetry_integrity',
        availability: 'available',
        contributesToScore: false,
        shadow: true,
        proposedScoreDelta: 3,
      }),
    ]
  }
  if (check.status === 'mismatch') {
    return [
      createFinding({
        code: 'session_token_mismatch',
        detail: `Session token bound to a different ${check.field}`,
        subject: 'visit',
        severity: 'high',
        source: 'telemetry_integrity',
        availability: 'available',
        contributesToScore: false,
        shadow: true,
        proposedScoreDelta: 8,
      }),
    ]
  }
  return [
    createFinding({
      code: 'session_token_invalid',
      detail: 'Session token signature or payload was invalid',
      subject: 'visit',
      severity: 'high',
      source: 'telemetry_integrity',
      availability: 'available',
      contributesToScore: false,
      shadow: true,
      proposedScoreDelta: 8,
    }),
  ]
}

export async function evaluateEventIntegrity(
  body: IngestEventBody,
  opts: { duplicateClaim: boolean },
): Promise<IntegrityResult> {
  const findings: AssessmentFinding[] = []
  findings.push(...tokenFindings(body))
  findings.push(...timestampFindings(body))

  const seqFinding = await checkSequenceReuse({
    sid: body.sid,
    lpId: body.lp_id,
    seq: body.seq,
  })
  if (seqFinding) findings.push(seqFinding)

  const fingerprint = contentFingerprint(body)
  const eventId = body.event_id?.trim() ?? ''
  let contentConflict = false
  let idempotentReplay = false
  let suppressCanonicalInsert = false
  let conflictRecordProps: Record<string, unknown> | null = null
  let contentOwnerToken: string | null = null

  if (eventId) {
    const replay = await claimContentFingerprint(eventId, fingerprint, {
      allowTakeover: !opts.duplicateClaim,
    })
    if (replay.status === 'conflict') {
      contentConflict = true
      suppressCanonicalInsert = true
      const conflictFinding = createFinding({
        code: 'event_id_content_conflict',
        detail: 'Same event_id presented with conflicting payload content',
        subject: 'visit',
        severity: 'high',
        source: 'telemetry_integrity',
        availability: 'available',
        contributesToScore: false,
        shadow: true,
        proposedScoreDelta: 10,
        evidenceRefs: [eventId],
      })
      findings.push(conflictFinding)
      conflictRecordProps = {
        kind: 'event_id_content_conflict',
        canonical_event_id: eventId,
        conflict_fingerprint: fingerprint.slice(0, 16),
        findings: [conflictFinding],
      }
    } else if (replay.status === 'same_complete') {
      idempotentReplay = true
      suppressCanonicalInsert = true
    } else if (replay.status === 'same_pending') {
      idempotentReplay = false
      suppressCanonicalInsert = opts.duplicateClaim
    } else if (replay.status === 'unavailable') {
      findings.push(
        createFinding({
          code: 'event_content_check_unavailable',
          detail: 'Event content integrity check could not run',
          subject: 'visit',
          severity: 'info',
          source: 'telemetry_integrity',
          availability: 'unavailable',
          contributesToScore: false,
          shadow: true,
        }),
      )
    } else if (replay.status === 'new' || replay.status === 'reclaimed') {
      contentOwnerToken = replay.ownerToken
      if (opts.duplicateClaim) {
        suppressCanonicalInsert = true
      }
    }
  }

  return {
    findings,
    contentConflict,
    idempotentReplay,
    suppressCanonicalInsert,
    conflictRecordProps,
    contentFingerprint: fingerprint,
    contentOwnerToken,
  }
}

export function serializeIntegrityFindings(
  findings: AssessmentFinding[],
): string {
  try {
    return JSON.stringify(findings)
  } catch {
    return '[]'
  }
}

export function newConflictEventId(canonicalEventId: string): string {
  const hash = createHash('sha256')
    .update(`conflict:${canonicalEventId}:${randomUUID()}`)
    .digest()
  const bytes = Buffer.alloc(16)
  hash.copy(bytes, 0, 0, 16)
  bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x80, 6)
  bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8)
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

export const __eventIntegrityTest = {
  CONTENT_PENDING,
  CONTENT_COMPLETE,
  contentFingerprint,
  pendingContentValue,
}
