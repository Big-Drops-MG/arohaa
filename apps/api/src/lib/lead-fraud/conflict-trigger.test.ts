import { describe, expect, it, vi, afterEach } from 'vitest'

const multiOps: Array<Array<[string, unknown[]]>> = []

vi.mock('../../services/redis.service.js', () => ({
  redis: {
    multi: vi.fn(() => {
      const ops: Array<[string, unknown[]]> = []
      const chain = {
        lpush: (...a: unknown[]) => {
          ops.push(['lpush', a])
          return chain
        },
        zadd: (...a: unknown[]) => {
          ops.push(['zadd', a])
          return chain
        },
        exec: async () => {
          multiOps.push(ops)
          return ops.map(() => [null, 1])
        },
      }
      return chain
    }),
    lpush: vi.fn(async () => 1),
  },
}))

import { pushAnalyticsEventWithVisitAssess } from './visit-assess-queue.js'

describe('conflict assessment trigger selection', () => {
  afterEach(() => {
    multiOps.length = 0
    vi.clearAllMocks()
  })

  it('records the queued conflict event id as the assessment trigger', async () => {
    const conflictId = 'abcdef01-2345-4789-8abc-def012345678'
    const originalId = '11111111-1111-4111-8111-111111111111'

    await pushAnalyticsEventWithVisitAssess({
      eventPayload: JSON.stringify({
        event_id: conflictId,
        event_name: 'telemetry_integrity',
      }),
      assess: {
        workspaceId: '22222222-2222-4222-8222-222222222222',
        sessionId: 'session-abcdefgh',
        reason: 'telemetry_integrity',
        triggerEventId: conflictId,
        delayMs: 5_000,
      },
    })

    expect(multiOps).toHaveLength(1)
    const zadd = multiOps[0]!.find(([op]) => op === 'zadd')
    expect(zadd).toBeTruthy()
    const job = JSON.parse(String(zadd![1][2]))
    expect(job.triggerEventId).toBe(conflictId)
    expect(job.triggerEventId).not.toBe(originalId)
  })
})
