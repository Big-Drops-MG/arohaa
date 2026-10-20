import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, string>()

vi.mock('../../services/redis.service.js', () => ({
  redis: {
    set: vi.fn(
      async (
        key: string,
        value: string,
        _ex: string,
        _ttl: number,
        nx?: string,
      ) => {
        if (nx === 'NX') {
          if (store.has(key)) return null
          store.set(key, value)
          return 'OK'
        }
        store.set(key, value)
        return 'OK'
      },
    ),
    del: vi.fn(async (key: string) => {
      store.delete(key)
      return 1
    }),
    eval: vi.fn(async (_script: string, _n: number, key: string, token: string) => {
      if (store.get(key) === token) {
        store.delete(key)
        return 1
      }
      return 0
    }),
  },
}))

import {
  claimLeadReviewRevision,
  releaseLeadReviewRevisionClaim,
  withLeadReviewLock,
} from './review-lock.js'

describe('review concurrency locks', () => {
  beforeEach(() => {
    store.clear()
  })

  it('allows only one revision claim for the same next revision', async () => {
    const input = {
      tenantWorkspaceId: 'org-1',
      workspaceId: 'lp-1',
      sessionId: 's-1',
      nextRevision: 1,
    }
    await expect(claimLeadReviewRevision(input)).resolves.toBe('claimed')
    await expect(claimLeadReviewRevision(input)).resolves.toBe('conflict')
    await releaseLeadReviewRevisionClaim(input)
    await expect(claimLeadReviewRevision(input)).resolves.toBe('claimed')
  })

  it('rejects a second writer while the review lock is held', async () => {
    const order: string[] = []
    const input = {
      tenantWorkspaceId: 'org-1',
      workspaceId: 'lp-1',
      sessionId: 's-2',
    }
    let releaseHold!: () => void
    const hold = new Promise<void>((resolve) => {
      releaseHold = resolve
    })

    const first = withLeadReviewLock({
      ...input,
      run: async () => {
        order.push('a-start')
        await hold
        order.push('a-end')
        return 'a'
      },
    })

    await new Promise((r) => setTimeout(r, 5))

    const second = withLeadReviewLock({
      ...input,
      run: async () => {
        order.push('b')
        return 'b'
      },
    })

    await expect(second).rejects.toThrow(/concurrent update/)
    releaseHold()
    await expect(first).resolves.toBe('a')
    expect(order).toEqual(['a-start', 'a-end'])
  })
})

