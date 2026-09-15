import { redis } from '../services/redis.service.js'

const IDEMPOTENCY_TTL_SEC = 60 * 60 * 48 // 48h covers client outbox retries
const EVENT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidEventId(value: string | undefined | null): boolean {
  if (!value) return false
  const trimmed = value.trim()
  return trimmed.length >= 8 && trimmed.length <= 64 && EVENT_ID_RE.test(trimmed)
}


export async function claimIngestEventId(
  eventId: string,
): Promise<'claimed' | 'duplicate' | 'unavailable'> {
  const key = `ingest:eid:${eventId.trim()}`
  try {
    const result = await redis.set(key, '1', 'EX', IDEMPOTENCY_TTL_SEC, 'NX')
    return result === 'OK' ? 'claimed' : 'duplicate'
  } catch {
    return 'unavailable'
  }
}

export async function releaseIngestEventId(eventId: string): Promise<void> {
  const key = `ingest:eid:${eventId.trim()}`
  try {
    await redis.del(key)
  } catch {
    // Best-effort; TTL still expires the key.
  }
}
