import { redis } from '../services/redis.service.js'

export const ANALYTICS_CACHE_TTL_SEC = 45

export async function readAnalyticsCache<T>(key: string): Promise<T | null> {
  try {
    const cached = await redis.get(key)
    if (cached) return JSON.parse(cached) as T
  } catch {
    // ignore cache read errors
  }
  return null
}

export async function writeAnalyticsCache(
  key: string,
  value: unknown,
): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ANALYTICS_CACHE_TTL_SEC)
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
