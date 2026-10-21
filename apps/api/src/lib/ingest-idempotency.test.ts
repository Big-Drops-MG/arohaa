import { afterEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, { value: string; expiresAt: number | null }>()

function getFresh(key: string) {
  const existing = store.get(key)
  if (!existing) return null
  if (existing.expiresAt != null && existing.expiresAt <= Date.now()) {
    store.delete(key)
    return null
  }
  return existing
}

vi.mock('../services/redis.service.js', () => ({
  redis: {
    set: vi.fn(async (key: string, value: string, ...args: unknown[]) => {
      const nx = args.includes('NX')
      const exIdx = args.indexOf('EX')
      const ttlSec = exIdx >= 0 ? Number(args[exIdx + 1]) : null
      getFresh(key)
      if (nx && store.has(key)) return null
      store.set(key, {
        value,
        expiresAt: ttlSec != null ? Date.now() + ttlSec * 1000 : null,
      })
      return 'OK'
    }),
    get: vi.fn(async (key: string) => getFresh(key)?.value ?? null),
    del: vi.fn(async (key: string) => {
      store.delete(key)
      return 1
    }),
    eval: vi.fn(async (script: string, _numKeys: number, ...args: unknown[]) => {
      const key = String(args[0])
      const arg1 = String(args[1])
      const entry = getFresh(key)
      if (script.includes('DEL')) {
        if (entry?.value === arg1) {
          store.delete(key)
          return 1
        }
        return 0
      }
      const completeValue = String(args[2])
      const ttlSec = Number(args[3])
      if (entry?.value === arg1) {
        store.set(key, {
          value: completeValue,
          expiresAt: Date.now() + ttlSec * 1000,
        })
        return 'OK'
      }
      return 0
    }),
  },
}))

import {
  claimIngestEventId,
  markIngestEventQueued,
  releaseIngestEventId,
  __ingestIdempotencyTest,
} from './ingest-idempotency.js'

describe('ingest event-id ownership lease', () => {
  afterEach(() => {
    store.clear()
    vi.clearAllMocks()
  })

  it('allows reclaim after a crash leaves only an expired pending lease', async () => {
    const eventId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const first = await claimIngestEventId(eventId)
    expect(first.status).toBe('claimed')
    expect(await claimIngestEventId(eventId)).toEqual({ status: 'duplicate' })

    const key = `ingest:eid:${eventId}`
    const entry = store.get(key)
    expect(entry?.value.startsWith('pending:')).toBe(true)
    store.set(key, { value: entry!.value, expiresAt: Date.now() - 1 })

    const again = await claimIngestEventId(eventId)
    expect(again.status).toBe('claimed')
  })

  it('rejects stale-owner completion and release after a newer claim', async () => {
    const eventId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const first = await claimIngestEventId(eventId)
    expect(first.status).toBe('claimed')
    if (first.status !== 'claimed') return

    const key = `ingest:eid:${eventId}`
    store.set(key, { value: store.get(key)!.value, expiresAt: Date.now() - 1 })

    const second = await claimIngestEventId(eventId)
    expect(second.status).toBe('claimed')
    if (second.status !== 'claimed') return

    expect(await markIngestEventQueued(eventId, first.ownerToken)).toBe(false)
    expect(await releaseIngestEventId(eventId, first.ownerToken)).toBe(false)

    expect(await markIngestEventQueued(eventId, second.ownerToken)).toBe(true)
    expect(store.get(key)?.value).toBe(__ingestIdempotencyTest.COMPLETE_VALUE)
    expect(await claimIngestEventId(eventId)).toEqual({ status: 'duplicate' })
  })

  it('releases pending ownership so handled failures can retry immediately', async () => {
    const eventId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    const first = await claimIngestEventId(eventId)
    expect(first.status).toBe('claimed')
    if (first.status !== 'claimed') return
    expect(await releaseIngestEventId(eventId, first.ownerToken)).toBe(true)
    const again = await claimIngestEventId(eventId)
    expect(again.status).toBe('claimed')
  })
})
