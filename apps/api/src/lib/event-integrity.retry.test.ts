import { afterEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, { value: string; expiresAt: number }>()
const sets = new Map<string, Set<string>>()

function fresh(key: string): string | null {
  const entry = store.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    store.delete(key)
    return null
  }
  return entry.value
}

function put(key: string, value: string, ttlSec: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 })
}

function emulateBundle(args: string[]): [string, string, string] {
  const arg = (i: number): string => args[i] ?? ''
  const eventKey = arg(0)
  const contentKey = arg(1)
  const seqKey = arg(2)
  const eventPending = arg(3)
  const eventTtl = Number(arg(4))
  const contentPending = arg(5)
  const contentTtl = Number(arg(6))
  const completePrefix = arg(7)
  const pendingPrefix = arg(8)
  const fingerprint = arg(9)
  const seqMember = arg(10)

  let eventStatus = 'duplicate'
  if (fresh(eventKey) === null) {
    put(eventKey, eventPending, eventTtl)
    eventStatus = 'claimed'
  }
  const claimed = eventStatus === 'claimed'
  const cur = fresh(contentKey)
  let contentStatus: string
  if (cur === null) {
    if (claimed) {
      put(contentKey, contentPending, contentTtl)
      contentStatus = 'new'
    } else {
      contentStatus = 'absent'
    }
  } else if (cur === completePrefix + fingerprint) {
    contentStatus = 'same_complete'
  } else if (cur.startsWith(completePrefix)) {
    contentStatus = 'conflict'
  } else if (cur.startsWith(pendingPrefix)) {
    const sep = cur.indexOf('|', pendingPrefix.length)
    if (sep < 0 || cur.slice(sep + 1) !== fingerprint) {
      contentStatus = 'conflict'
    } else if (claimed) {
      put(contentKey, contentPending, contentTtl)
      contentStatus = 'reclaimed'
    } else {
      contentStatus = 'same_pending'
    }
  } else if (cur === fingerprint) {
    contentStatus = 'same_complete'
  } else {
    contentStatus = 'conflict'
  }
  let seqStatus = 'skipped'
  if (claimed && seqMember !== '') {
    const members = sets.get(seqKey) ?? new Set<string>()
    sets.set(seqKey, members)
    seqStatus = members.has(seqMember) ? 'reused' : 'added'
    members.add(seqMember)
  }
  return [eventStatus, contentStatus, seqStatus]
}

function emulateTwoKeyOwnership(args: string[]): [number, number] {
  const arg = (i: number): string => args[i] ?? ''
  const eventKey = arg(0)
  const contentKey = arg(1)
  const eventExpected = arg(2)
  const eventNext = arg(3)
  const eventTtl = Number(arg(4))
  const contentExpected = arg(5)
  const contentNext = arg(6)
  const contentTtl = Number(arg(7))
  let eok = 0
  let cok = 0
  if (fresh(eventKey) === eventExpected) {
    put(eventKey, eventNext, eventTtl)
    eok = 1
  }
  if (fresh(contentKey) === contentExpected) {
    put(contentKey, contentNext, contentTtl)
    cok = 1
  }
  return [eok, cok]
}

function emulateReleaseBoth(args: string[]): [number, number] {
  const eventKey = args[0] ?? ''
  const contentKey = args[1] ?? ''
  const eventExpected = args[2] ?? ''
  const contentExpected = args[3] ?? ''
  let eok = 0
  let cok = 0
  if (fresh(eventKey) === eventExpected) {
    store.delete(eventKey)
    eok = 1
  }
  if (contentExpected !== '' && fresh(contentKey) === contentExpected) {
    store.delete(contentKey)
    cok = 1
  }
  return [eok, cok]
}

function emulateReleaseOne(args: string[]): number {
  const key = args[0] ?? ''
  const expected = args[1] ?? ''
  if (fresh(key) === expected) {
    store.delete(key)
    return 1
  }
  return 0
}

vi.mock('../services/redis.service.js', () => ({
  redis: {
    eval: vi.fn(async (script: string, _numKeys: number, ...rest: unknown[]) => {
      const args = rest.map(String)
      if (script.includes('eventStatus')) return emulateBundle(args)
      if (script.includes('eok') && script.includes('DEL')) {
        return emulateReleaseBoth(args)
      }
      if (script.includes('eok')) return emulateTwoKeyOwnership(args)
      if (script.includes('DEL')) return emulateReleaseOne(args)
      return 0
    }),
  },
}))

import { claimIngestBundle, evaluateEventIntegrity } from './event-integrity.js'
import {
  markIngestOwnershipQueued,
  releaseIngestOwnership,
} from './ingest-idempotency.js'

function bodyFor(eventId: string) {
  return {
    event_id: eventId,
    sid: 'session-abcdefgh',
    uid: 'user-abcdefghij',
    wid: '22222222-2222-4222-8222-222222222222',
    ev: 'page_view' as const,
    ts: Date.now(),
    sdk_version: '1.1.0',
  }
}

describe('ingest bundle claim and content pending vs complete', () => {
  afterEach(() => {
    store.clear()
    sets.clear()
    vi.clearAllMocks()
  })

  it('allows takeover retry when content was observed but never marked queued', async () => {
    const eventId = '11111111-1111-4111-8111-111111111111'
    const body = bodyFor(eventId)
    const eventKey = `ingest:eid:${eventId}`

    const first = await evaluateEventIntegrity(body)
    expect(first.suppressCanonicalInsert).toBe(false)
    expect(first.contentOwnerToken).toBeTruthy()
    if (first.eventClaim.status !== 'claimed') throw new Error('expected claim')

    const concurrent = await evaluateEventIntegrity(body)
    expect(concurrent.eventClaim.status).toBe('duplicate')
    expect(concurrent.suppressCanonicalInsert).toBe(true)
    expect(concurrent.contentOwnerToken).toBeNull()

    store.delete(eventKey)

    const afterFailure = await evaluateEventIntegrity(body)
    expect(afterFailure.suppressCanonicalInsert).toBe(false)
    expect(afterFailure.contentOwnerToken).toBeTruthy()
    if (afterFailure.eventClaim.status !== 'claimed') {
      throw new Error('expected claim')
    }

    await markIngestOwnershipQueued({
      eventId,
      eventOwnerToken: afterFailure.eventClaim.ownerToken,
      contentFingerprint: afterFailure.contentFingerprint,
      contentOwnerToken: afterFailure.contentOwnerToken ?? '',
    })

    const complete = await evaluateEventIntegrity(body)
    expect(complete.suppressCanonicalInsert).toBe(true)
    expect(complete.idempotentReplay).toBe(true)
  })

  it('rejects stale owner completion after takeover', async () => {
    const eventId = '33333333-3333-4333-8333-333333333333'
    const eventKey = `ingest:eid:${eventId}`
    const first = await claimIngestBundle({ eventId, fingerprint: 'fp-a' })
    if (first.eventClaim.status !== 'claimed') throw new Error('expected claim')
    if (first.content.status !== 'new') throw new Error('expected new content')

    store.delete(eventKey)

    const takeover = await claimIngestBundle({ eventId, fingerprint: 'fp-a' })
    if (takeover.eventClaim.status !== 'claimed') {
      throw new Error('expected takeover claim')
    }
    if (takeover.content.status !== 'reclaimed') {
      throw new Error('expected reclaimed content')
    }

    expect(
      await markIngestOwnershipQueued({
        eventId,
        eventOwnerToken: first.eventClaim.ownerToken,
        contentFingerprint: 'fp-a',
        contentOwnerToken: first.content.ownerToken,
      }),
    ).toEqual({ eventOk: false, contentOk: false })

    expect(
      await markIngestOwnershipQueued({
        eventId,
        eventOwnerToken: takeover.eventClaim.ownerToken,
        contentFingerprint: 'fp-a',
        contentOwnerToken: takeover.content.ownerToken,
      }),
    ).toEqual({ eventOk: true, contentOk: true })
  })

  it('flags conflicting fingerprints under the same event id', async () => {
    const eventId = '44444444-4444-4444-8444-444444444444'
    const first = await claimIngestBundle({ eventId, fingerprint: 'fp-a' })
    if (first.eventClaim.status !== 'claimed') throw new Error('expected claim')
    if (first.content.status !== 'new') throw new Error('expected new content')

    await markIngestOwnershipQueued({
      eventId,
      eventOwnerToken: first.eventClaim.ownerToken,
      contentFingerprint: 'fp-a',
      contentOwnerToken: first.content.ownerToken,
    })

    const conflicting = await claimIngestBundle({ eventId, fingerprint: 'fp-b' })
    expect(conflicting.content).toEqual({ status: 'conflict' })
  })

  it('keeps content read-only when the event id is a duplicate', async () => {
    const eventId = '55555555-5555-4555-8555-555555555555'
    const first = await claimIngestBundle({ eventId, fingerprint: 'fp-a' })
    if (first.content.status !== 'new') throw new Error('expected new content')

    const replay = await claimIngestBundle({ eventId, fingerprint: 'fp-a' })
    expect(replay.eventClaim.status).toBe('duplicate')
    expect(replay.content.status).toBe('same_pending')
    expect(store.get(`ingest:eid:body:${eventId}`)?.value).toBe(
      `pending:${first.content.ownerToken}|fp-a`,
    )
  })

  it('does not write content for a duplicate with no existing content', async () => {
    const eventId = '66666666-6666-4666-8666-666666666666'
    await claimIngestBundle({ eventId, fingerprint: 'seed' })
    store.delete(`ingest:eid:body:${eventId}`)

    const replay = await claimIngestBundle({ eventId, fingerprint: 'fp-x' })
    expect(replay.eventClaim.status).toBe('duplicate')
    expect(replay.content).toEqual({ status: 'absent' })
    expect(store.has(`ingest:eid:body:${eventId}`)).toBe(false)
  })

  it('releases both ownership keys when a claimed event fails downstream', async () => {
    const eventId = '77777777-7777-4777-8777-777777777777'
    const bundle = await claimIngestBundle({ eventId, fingerprint: 'fp-r' })
    if (bundle.eventClaim.status !== 'claimed') throw new Error('expected claim')
    if (bundle.content.status !== 'new') throw new Error('expected new content')

    await releaseIngestOwnership({
      eventId,
      eventOwnerToken: bundle.eventClaim.ownerToken,
      contentFingerprint: 'fp-r',
      contentOwnerToken: bundle.content.ownerToken,
    })
    expect(store.has(`ingest:eid:${eventId}`)).toBe(false)
    expect(store.has(`ingest:eid:body:${eventId}`)).toBe(false)
  })
})
