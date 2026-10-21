import { redis } from '../services/redis.service.js'


export const ANALYTICS_CACHE_TTL_SEC = 120
export const ANALYTICS_CACHE_STALE_SEC = 60
const REVALIDATE_LOCK_SEC = 30

type Envelope<T> = { __swr: 1; fresh_until: number; v: T }

function isEnvelope<T>(value: unknown): value is Envelope<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { __swr?: unknown }).__swr === 1 &&
    typeof (value as { fresh_until?: unknown }).fresh_until === 'number'
  )
}

export async function readAnalyticsCache<T>(key: string): Promise<T | null> {
  try {
    const cached = await redis.get(key)
    if (!cached) return null
    const parsed = JSON.parse(cached) as unknown
    if (!isEnvelope<T>(parsed)) return parsed as T
    if (Date.now() < parsed.fresh_until) return parsed.v

    const lock = await redis.set(`${key}:revalidating`, '1', 'EX', REVALIDATE_LOCK_SEC, 'NX')
    if (lock === 'OK') return null
    return parsed.v
  } catch {
    return null
  }
}

export async function writeAnalyticsCache(
  key: string,
  value: unknown,
  ttlSec: number = ANALYTICS_CACHE_TTL_SEC,
  staleSec: number = ANALYTICS_CACHE_STALE_SEC,
): Promise<void> {
  try {
    const ttl = Number.isFinite(ttlSec) && ttlSec > 0 ? Math.floor(ttlSec) : ANALYTICS_CACHE_TTL_SEC
    const stale = Number.isFinite(staleSec) && staleSec >= 0 ? Math.floor(staleSec) : 0
    const envelope: Envelope<unknown> = {
      __swr: 1,
      fresh_until: Date.now() + ttl * 1000,
      v: value,
    }
    await redis.set(key, JSON.stringify(envelope), 'EX', ttl + stale)
    await redis.del(`${key}:revalidating`)
  } catch {
    // ignore cache write errors
  }
}

export async function invalidateAnalyticsCache(prefix: string): Promise<void> {
  try {
    const stream = redis.scanStream({ match: `${prefix}*`, count: 100 })
    const keys: string[] = []
    for await (const batch of stream) {
      keys.push(...(batch as string[]))
    }
    if (keys.length > 0) await redis.del(...keys)
  } catch {
    // ignore cache invalidation errors
  }
}
