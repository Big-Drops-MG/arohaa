import { randomUUID } from 'node:crypto'
import { redis } from '../services/redis.service.js'

const COMPLETE_TTL_SEC = 60 * 60 * 24 * 30

export const INGEST_OWNER_LEASE_SEC = 90

const EVENT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PENDING_PREFIX = 'pending:'
const COMPLETE_VALUE = 'complete'

const CLAIM_LUA = `
if redis.call("SET", KEYS[1], ARGV[1], "EX", tonumber(ARGV[2]), "NX") then
  return "claimed"
end
return "duplicate"
`

const COMPLETE_IF_OWNER_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("SET", KEYS[1], ARGV[2], "EX", tonumber(ARGV[3]))
end
return 0
`

const RELEASE_IF_OWNER_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`

/**
 * Finalize event-id + content ownership in one EVAL (2 keys).
 * KEYS[1]=event, KEYS[2]=content
 */
const COMPLETE_BOTH_IF_OWNER_LUA = `
local eok = 0
local cok = 0
if redis.call("GET", KEYS[1]) == ARGV[1] then
  redis.call("SET", KEYS[1], ARGV[2], "EX", tonumber(ARGV[3]))
  eok = 1
end
if redis.call("GET", KEYS[2]) == ARGV[4] then
  redis.call("SET", KEYS[2], ARGV[5], "EX", tonumber(ARGV[6]))
  cok = 1
end
return {eok, cok}
`

const RELEASE_BOTH_IF_OWNER_LUA = `
local eok = 0
local cok = 0
if redis.call("GET", KEYS[1]) == ARGV[1] then
  redis.call("DEL", KEYS[1])
  eok = 1
end
if ARGV[2] ~= '' and redis.call("GET", KEYS[2]) == ARGV[2] then
  redis.call("DEL", KEYS[2])
  cok = 1
end
return {eok, cok}
`

export type IngestEventClaim =
  | { status: 'claimed'; ownerToken: string }
  | { status: 'duplicate' }
  | { status: 'unavailable' }

export function isValidEventId(value: string | undefined | null): boolean {
  if (!value) return false
  const trimmed = value.trim()
  return trimmed.length >= 8 && trimmed.length <= 64 && EVENT_ID_RE.test(trimmed)
}

export function eventIdKey(eventId: string): string {
  return `ingest:eid:${eventId.trim()}`
}

export function contentIdKey(eventId: string): string {
  return `ingest:eid:body:${eventId.trim()}`
}

export function pendingValue(ownerToken: string): string {
  return `${PENDING_PREFIX}${ownerToken}`
}

export function pendingContentValue(
  ownerToken: string,
  fingerprint: string,
): string {
  return `${PENDING_PREFIX}${ownerToken}|${fingerprint}`
}

export function completeContentValue(fingerprint: string): string {
  return `complete:${fingerprint}`
}

export async function claimIngestEventId(
  eventId: string,
): Promise<IngestEventClaim> {
  const key = eventIdKey(eventId)
  const ownerToken = randomUUID()
  const token = pendingValue(ownerToken)
  try {
    const outcome = (await redis.eval(
      CLAIM_LUA,
      1,
      key,
      token,
      String(INGEST_OWNER_LEASE_SEC),
    )) as string
    if (outcome === 'claimed') return { status: 'claimed', ownerToken }
    return { status: 'duplicate' }
  } catch {
    return { status: 'unavailable' }
  }
}

export async function markIngestEventQueued(
  eventId: string,
  ownerToken: string,
): Promise<boolean> {
  const key = eventIdKey(eventId)
  try {
    const result = await redis.eval(
      COMPLETE_IF_OWNER_LUA,
      1,
      key,
      pendingValue(ownerToken),
      COMPLETE_VALUE,
      String(COMPLETE_TTL_SEC),
    )
    return result === 'OK' || result === 1
  } catch {
    return false
  }
}

export async function releaseIngestEventId(
  eventId: string,
  ownerToken: string,
): Promise<boolean> {
  const key = eventIdKey(eventId)
  try {
    const result = await redis.eval(
      RELEASE_IF_OWNER_LUA,
      1,
      key,
      pendingValue(ownerToken),
    )
    return Number(result) === 1
  } catch {
    return false
  }
}

export async function markIngestOwnershipQueued(input: {
  eventId: string
  eventOwnerToken: string
  contentFingerprint: string
  contentOwnerToken: string
}): Promise<{ eventOk: boolean; contentOk: boolean }> {
  const eventId = input.eventId.trim()
  try {
    const result = (await redis.eval(
      COMPLETE_BOTH_IF_OWNER_LUA,
      2,
      eventIdKey(eventId),
      contentIdKey(eventId),
      pendingValue(input.eventOwnerToken),
      COMPLETE_VALUE,
      String(COMPLETE_TTL_SEC),
      pendingContentValue(input.contentOwnerToken, input.contentFingerprint),
      completeContentValue(input.contentFingerprint),
      String(COMPLETE_TTL_SEC),
    )) as [number, number] | number[]
    const eok = Number(Array.isArray(result) ? result[0] : 0)
    const cok = Number(Array.isArray(result) ? result[1] : 0)
    return { eventOk: eok === 1, contentOk: cok === 1 }
  } catch {
    return { eventOk: false, contentOk: false }
  }
}

export async function releaseIngestOwnership(input: {
  eventId: string
  eventOwnerToken?: string | null
  contentFingerprint?: string
  contentOwnerToken?: string | null
}): Promise<void> {
  const eventId = input.eventId.trim()
  const eventPending = input.eventOwnerToken
    ? pendingValue(input.eventOwnerToken)
    : ''
  const contentPending =
    input.contentOwnerToken && input.contentFingerprint
      ? pendingContentValue(input.contentOwnerToken, input.contentFingerprint)
      : ''

  if (!eventPending && !contentPending) return

  try {
    if (eventPending && contentPending) {
      await redis.eval(
        RELEASE_BOTH_IF_OWNER_LUA,
        2,
        eventIdKey(eventId),
        contentIdKey(eventId),
        eventPending,
        contentPending,
      )
      return
    }
    if (eventPending) {
      await redis.eval(
        RELEASE_IF_OWNER_LUA,
        1,
        eventIdKey(eventId),
        eventPending,
      )
      return
    }
    if (contentPending) {
      await redis.eval(
        RELEASE_IF_OWNER_LUA,
        1,
        contentIdKey(eventId),
        contentPending,
      )
    }
  } catch {
    /* best-effort release */
  }
}

export const __ingestIdempotencyTest = {
  PENDING_PREFIX,
  COMPLETE_VALUE,
  COMPLETE_TTL_SEC,
  INGEST_OWNER_LEASE_SEC,
  pendingValue,
  COMPLETE_IF_OWNER_LUA,
  RELEASE_IF_OWNER_LUA,
  CLAIM_LUA,
  COMPLETE_BOTH_IF_OWNER_LUA,
}
