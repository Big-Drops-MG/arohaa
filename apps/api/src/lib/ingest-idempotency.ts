import { randomUUID } from 'node:crypto'
import { redis } from '../services/redis.service.js'

const COMPLETE_TTL_SEC = 60 * 60 * 24 * 30

export const INGEST_OWNER_LEASE_SEC = 90

const EVENT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PENDING_PREFIX = 'pending:'
const COMPLETE_VALUE = 'complete'

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

export type IngestEventClaim =
  | { status: 'claimed'; ownerToken: string }
  | { status: 'duplicate' }
  | { status: 'unavailable' }

export function isValidEventId(value: string | undefined | null): boolean {
  if (!value) return false
  const trimmed = value.trim()
  return trimmed.length >= 8 && trimmed.length <= 64 && EVENT_ID_RE.test(trimmed)
}

function eventIdKey(eventId: string): string {
  return `ingest:eid:${eventId.trim()}`
}

function isCompleteValue(value: string): boolean {
  return value === COMPLETE_VALUE || value === '1'
}

function isPendingValue(value: string): boolean {
  return value.startsWith(PENDING_PREFIX)
}

function pendingValue(ownerToken: string): string {
  return `${PENDING_PREFIX}${ownerToken}`
}

export async function claimIngestEventId(
  eventId: string,
): Promise<IngestEventClaim> {
  const key = eventIdKey(eventId)
  const ownerToken = randomUUID()
  const token = pendingValue(ownerToken)
  try {
    const claimed = await redis.set(
      key,
      token,
      'EX',
      INGEST_OWNER_LEASE_SEC,
      'NX',
    )
    if (claimed === 'OK') return { status: 'claimed', ownerToken }

    const existing = await redis.get(key)
    if (!existing) {
      const retry = await redis.set(
        key,
        token,
        'EX',
        INGEST_OWNER_LEASE_SEC,
        'NX',
      )
      return retry === 'OK'
        ? { status: 'claimed', ownerToken }
        : { status: 'unavailable' }
    }

    if (isCompleteValue(existing) || isPendingValue(existing)) {
      return { status: 'duplicate' }
    }

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

export const __ingestIdempotencyTest = {
  PENDING_PREFIX,
  COMPLETE_VALUE,
  COMPLETE_TTL_SEC,
  INGEST_OWNER_LEASE_SEC,
  pendingValue,
  COMPLETE_IF_OWNER_LUA,
  RELEASE_IF_OWNER_LUA,
}
