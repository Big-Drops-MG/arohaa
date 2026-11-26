import { createHash, randomUUID } from 'node:crypto'
import { redis } from '../services/redis.service.js'
import type { IngestEventBody } from '../types/event.js'
import {
  contentIdKey,
  eventIdKey,
  INGEST_OWNER_LEASE_SEC,
  pendingContentValue,
  pendingValue,
  type IngestEventClaim,
} from './ingest-idempotency.js'
import { verifySessionToken } from './session-token.js'
import {
  createFinding,
  type AssessmentFinding,
} from './lead-fraud/findings.js'

const SEQ_TTL_SEC = 60 * 60 * 24
const CONTENT_PENDING_TTL_SEC = 90
const CLOCK_SKEW_MS = 10 * 60_000
const FUTURE_SKEW_MS = 5 * 60_000

const CONTENT_PENDING = 'pending:'
const CONTENT_COMPLETE = 'complete:'

const INGEST_CLAIM_BUNDLE_LUA = `
local eventStatus = "duplicate"
if redis.call("SET", KEYS[1], ARGV[1], "EX", tonumber(ARGV[2]), "NX") then
  eventStatus = "claimed"
end
local claimed = eventStatus == "claimed"
local cur = redis.call("GET", KEYS[2])
local completePrefix = ARGV[5]
local pendingPrefix = ARGV[6]
local fingerprint = ARGV[7]
local contentStatus
if not cur then
  if claimed then
    redis.call("SET", KEYS[2], ARGV[3], "EX", tonumber(ARGV[4]))
    contentStatus = "new"
  else
    contentStatus = "absent"
  end
elseif cur == (completePrefix .. fingerprint) then
  contentStatus = "same_complete"
elseif string.sub(cur, 1, #completePrefix) == completePrefix then
  contentStatus = "conflict"
elseif string.sub(cur, 1, #pendingPrefix) == pendingPrefix then
  local sep = string.find(cur, "|", #pendingPrefix + 1, true)
  if not sep then
    contentStatus = "conflict"
  elseif string.sub(cur, sep + 1) ~= fingerprint then
    contentStatus = "conflict"
  elseif claimed then
    redis.call("SET", KEYS[2], ARGV[3], "EX", tonumber(ARGV[4]))
    contentStatus = "reclaimed"
  else
    contentStatus = "same_pending"
  end
elseif cur == fingerprint then
  contentStatus = "same_complete"
else
  contentStatus = "conflict"
end
local seqStatus = "skipped"
if claimed and ARGV[8] ~= "" then
  local added = redis.call("SADD", KEYS[3], ARGV[8])
  redis.call("EXPIRE", KEYS[3], tonumber(ARGV[9]))
  if added == 0 then
    seqStatus = "reused"
  else
    seqStatus = "added"
  end
end
return {eventStatus, contentStatus, seqStatus}
`

export type ContentClaimResult =
  | { status: 'new'; ownerToken: string }
  | { status: 'reclaimed'; ownerToken: string }
  | { status: 'same_complete' }
  | { status: 'same_pending' }
  | { status: 'absent' }
  | { status: 'conflict' }
  | { status: 'unavailable' }

export type IngestClaimBundle = {
  eventClaim: IngestEventClaim
  content: ContentClaimResult
  seqStatus: 'skipped' | 'added' | 'reused'
}

export type IntegrityResult = {
  findings: AssessmentFinding[]
  contentConflict: boolean
  idempotentReplay: boolean
  suppressCanonicalInsert: boolean
  conflictRecordProps: Record<string, unknown> | null
  contentFingerprint: string
  contentOwnerToken: string | null
  eventClaim: IngestEventClaim
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

function seqSetKey(lpId: string | undefined, sid: string): string {
  const scope = `${(lpId ?? '').trim() || '_'}:${sid.trim()}`
  return `ingest:seqset:${scope}`
}

function seqMemberFor(seq: number | undefined): string {
  if (typeof seq !== 'number' || !Number.isFinite(seq) || seq <= 0) return ''
  return String(Math.floor(seq))
}

function contentResult(
  status: string,
  ownerToken: string,
): ContentClaimResult {
  if (status === 'new') return { status: 'new', ownerToken }
  if (status === 'reclaimed') return { status: 'reclaimed', ownerToken }
  if (status === 'same_complete') return { status: 'same_complete' }
  if (status === 'same_pending') return { status: 'same_pending' }
  if (status === 'absent') return { status: 'absent' }
  if (status === 'conflict') return { status: 'conflict' }
  return { status: 'unavailable' }
}

const UNAVAILABLE_BUNDLE: IngestClaimBundle = {
  eventClaim: { status: 'unavailable' },
  content: { status: 'unavailable' },
  seqStatus: 'skipped',
}

export async function claimIngestBundle(input: {
  eventId: string
  fingerprint: string
  sid?: string
  lpId?: string
  seq?: number
}): Promise<IngestClaimBundle> {
  const eventId = input.eventId.trim()
  if (!eventId) return UNAVAILABLE_BUNDLE
  const eventOwnerToken = randomUUID()
  const contentOwnerToken = randomUUID()
  try {
    const [eventStatus, contentStatus, seqStatus] = (await redis.eval(
      INGEST_CLAIM_BUNDLE_LUA,
      3,
      eventIdKey(eventId),
      contentIdKey(eventId),
      seqSetKey(input.lpId, input.sid ?? ''),
      pendingValue(eventOwnerToken),
      String(INGEST_OWNER_LEASE_SEC),
      pendingContentValue(contentOwnerToken, input.fingerprint),
      String(CONTENT_PENDING_TTL_SEC),
      CONTENT_COMPLETE,
      CONTENT_PENDING,
      input.fingerprint,
      seqMemberFor(input.seq),
      String(SEQ_TTL_SEC),
    )) as [string, string, string]

    const eventClaim: IngestEventClaim =
      eventStatus === 'claimed'
        ? { status: 'claimed', ownerToken: eventOwnerToken }
        : { status: 'duplicate' }
    const seq =
      seqStatus === 'added' || seqStatus === 'reused' ? seqStatus : 'skipped'
    return {
      eventClaim,
      content: contentResult(contentStatus, contentOwnerToken),
      seqStatus: seq,
    }
  } catch {
    return UNAVAILABLE_BUNDLE
  }
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
): Promise<IntegrityResult> {
  const findings: AssessmentFinding[] = [
    ...tokenFindings(body),
    ...timestampFindings(body),
  ]
  const fingerprint = contentFingerprint(body)
  const eventId = body.event_id?.trim() ?? ''
  const bundle = await claimIngestBundle({
    eventId,
    fingerprint,
    sid: body.sid,
    lpId: body.lp_id,
    seq: body.seq,
  })

  if (bundle.seqStatus === 'reused') {
    const seq = Math.floor(body.seq ?? 0)
    findings.push(
      createFinding({
        code: 'event_sequence_reuse',
        detail: `Session sequence ${seq} was reused for this page/session`,
        subject: 'visit',
        severity: 'medium',
        source: 'telemetry_integrity',
        availability: 'available',
        contributesToScore: false,
        shadow: true,
        proposedScoreDelta: 4,
      }),
    )
  }

  const duplicateClaim = bundle.eventClaim.status === 'duplicate'
  const replay = bundle.content
  let contentConflict = false
  let idempotentReplay = false
  let suppressCanonicalInsert = false
  let conflictRecordProps: Record<string, unknown> | null = null
  let contentOwnerToken: string | null = null

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
    suppressCanonicalInsert = duplicateClaim
  } else if (replay.status === 'absent') {
    suppressCanonicalInsert = true
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
    if (duplicateClaim) {
      suppressCanonicalInsert = true
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
    eventClaim: bundle.eventClaim,
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
  INGEST_CLAIM_BUNDLE_LUA,
}
