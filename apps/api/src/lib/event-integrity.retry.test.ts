import { afterEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, string>()

vi.mock('../services/redis.service.js', () => ({
  redis: {
    set: vi.fn(async (key: string, value: string, ...args: unknown[]) => {
      const nx = args.includes('NX')
      if (nx && store.has(key)) return null
      store.set(key, value)
      return 'OK'
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    del: vi.fn(async (key: string) => {
      store.delete(key)
      return 1
    }),
    sadd: vi.fn(async () => 1),
    expire: vi.fn(async () => 1),
    eval: vi.fn(async (script: string, _n: number, ...args: unknown[]) => {
      const key = String(args[0])
      if (script.includes('ZRANGEBYSCORE')) return 0
      if (script.includes('DEL')) {
        if (store.get(key) === String(args[1])) {
          store.delete(key)
          return 1
        }
        return 0
      }
      if (script.includes('complete:') || script.includes('SET')) {
        if (script.includes('ZRANGEBYSCORE')) return 0
        if (script.includes('pendingPrefix') || script.includes('pending:')) {
          const pendingValue = String(args[1])
          const completePrefix = String(args[3])
          const pendingPrefix = String(args[4])
          const fingerprint = String(args[5])
          const allowTakeover = String(args[6]) === '1'
          const cur = store.get(key)
          if (!cur) {
            store.set(key, pendingValue)
            return 'new'
          }
          if (cur === `${completePrefix}${fingerprint}`) return 'same_complete'
          if (cur.startsWith(completePrefix)) return 'conflict'
          if (cur.startsWith(pendingPrefix)) {
            const sep = cur.indexOf('|', pendingPrefix.length)
            if (sep < 0) return 'conflict'
            const fp = cur.slice(sep + 1)
            if (fp !== fingerprint) return 'conflict'
            if (allowTakeover) {
              store.set(key, pendingValue)
              return 'reclaimed'
            }
            return 'same_pending'
          }
          if (cur === fingerprint) return 'same_complete'
          return 'conflict'
        }
        if (store.get(key) === String(args[1])) {
          store.set(key, String(args[2]))
          return 'OK'
        }
        return 0
      }
      return 0
    }),
  },
}))

import {
  claimContentFingerprint,
  evaluateEventIntegrity,
  markContentQueued,
  releaseContentClaim,
  __eventIntegrityTest,
} from './event-integrity.js'

describe('content claim pending vs complete', () => {
  afterEach(() => {
    store.clear()
    vi.clearAllMocks()
  })

  it('allows takeover retry when content was observed but never marked queued', async () => {
    const eventId = '11111111-1111-4111-8111-111111111111'
    const body = {
      event_id: eventId,
      sid: 'session-abcdefgh',
      uid: 'user-abcdefghij',
      wid: '22222222-2222-4222-8222-222222222222',
      ev: 'page_view' as const,
      ts: Date.now(),
      sdk_version: '1.1.0',
    }

    const first = await evaluateEventIntegrity(body, { duplicateClaim: false })
    expect(first.suppressCanonicalInsert).toBe(false)
    expect(first.contentOwnerToken).toBeTruthy()

    const concurrent = await evaluateEventIntegrity(body, {
      duplicateClaim: true,
    })
    expect(concurrent.suppressCanonicalInsert).toBe(true)
    expect(concurrent.contentOwnerToken).toBeNull()

    const afterFailure = await evaluateEventIntegrity(body, {
      duplicateClaim: false,
    })
    expect(afterFailure.suppressCanonicalInsert).toBe(false)
    expect(afterFailure.contentOwnerToken).toBeTruthy()

    await markContentQueued(
      eventId,
      first.contentFingerprint,
      afterFailure.contentOwnerToken!,
    )
    const complete = await evaluateEventIntegrity(body, { duplicateClaim: true })
    expect(complete.suppressCanonicalInsert).toBe(true)
    expect(complete.idempotentReplay).toBe(true)
  })

  it('rejects stale content owner completion after takeover', async () => {
    const eventId = '33333333-3333-4333-8333-333333333333'
    const first = await claimContentFingerprint(eventId, 'fp-a')
    expect(first.status).toBe('new')
    if (first.status !== 'new') return

    const takeover = await claimContentFingerprint(eventId, 'fp-a', {
      allowTakeover: true,
    })
    expect(takeover.status).toBe('reclaimed')
    if (takeover.status !== 'reclaimed') return

    expect(
      await markContentQueued(eventId, 'fp-a', first.ownerToken),
    ).toBe(false)
    expect(
      await releaseContentClaim(eventId, first.ownerToken, 'fp-a'),
    ).toBe(false)
    expect(
      await markContentQueued(eventId, 'fp-a', takeover.ownerToken),
    ).toBe(true)
  })

  it('flags conflicting fingerprints under the same event id', async () => {
    const eventId = '44444444-4444-4444-8444-444444444444'
    const first = await claimContentFingerprint(eventId, 'fp-a')
    expect(first.status).toBe('new')
    if (first.status !== 'new') return
    await markContentQueued(eventId, 'fp-a', first.ownerToken)
    expect(await claimContentFingerprint(eventId, 'fp-b')).toEqual({
      status: 'conflict',
    })
  })

  it('exposes pending content value format used by owner checks', () => {
    const value = __eventIntegrityTest.pendingContentValue('tok', 'fp')
    expect(value).toBe('pending:tok|fp')
  })
})
