import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type StreamMsg = { id: string; payload: string; idleMs: number }

const {
  stream,
  delayed,
  dead,
  acked,
  ensureSessionVisitAssessment,
  isSessionEventPersisted,
  multiCalls,
} = vi.hoisted(() => ({
  stream: [] as StreamMsg[],
  delayed: new Map<string, number>(),
  dead: [] as string[],
  acked: new Set<string>(),
  multiCalls: [] as Array<Array<[string, unknown[]]>>,
  ensureSessionVisitAssessment: vi.fn(),
  isSessionEventPersisted: vi.fn(),
}))

let idSeq = 1
function nextId() {
  return `${idSeq++}-0`
}

vi.mock('../../services/redis.service.js', () => ({
  redis: {
    xgroup: vi.fn(async () => 'OK'),
    xadd: vi.fn(async (_stream: string, _id: string, field: string, value: string) => {
      const id = nextId()
      stream.push({ id, payload: field === 'payload' ? value : '', idleMs: 0 })
      return id
    }),
    xreadgroup: vi.fn(async () => {
      const fresh = stream.filter((m) => !acked.has(m.id) && m.idleMs === 0)
      if (!fresh.length) return null
      for (const m of fresh) m.idleMs = 1
      return [
        [
          'visit_assess_stream',
          fresh.map((m) => [m.id, ['payload', m.payload]]),
        ],
      ]
    }),
    xautoclaim: vi.fn(async () => {
      const stale = stream.filter((m) => !acked.has(m.id) && m.idleMs >= 60_000)
      return ['0-0', stale.map((m) => [m.id, ['payload', m.payload]])]
    }),
    xack: vi.fn(async (_s: string, _g: string, id: string) => {
      acked.add(id)
      return 1
    }),
    zadd: vi.fn(async (_key: string, score: number, member: string) => {
      delayed.set(member, score)
      return 1
    }),
    zrangebyscore: vi.fn(async () => []),
    zrem: vi.fn(async () => 0),
    lpush: vi.fn(async (_key: string, value: string) => {
      if (_key === 'visit_assess_dead') {
        dead.push(value)
        return dead.length
      }
      return 1
    }),
    eval: vi.fn(async (script: string, _n: number, ...args: unknown[]) => {
      if (String(script).includes('ZRANGEBYSCORE')) {
        const now = Number(args[2])
        const limit = Number(args[3])
        const ready = [...delayed.entries()]
          .filter(([, score]) => score <= now)
          .slice(0, limit)
        let moved = 0
        for (const [member] of ready) {
          if (!delayed.delete(member)) continue
          const id = nextId()
          stream.push({ id, payload: member, idleMs: 0 })
          moved += 1
        }
        return moved
      }
      return 0
    }),
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
          multiCalls.push(ops)
          for (const [op, a] of ops) {
            if (op === 'lpush') {
            }
            if (op === 'zadd') {
              delayed.set(String(a[2]), Number(a[1]))
            }
          }
          return ops.map(() => [null, 1])
        },
      }
      return chain
    }),
  },
}))

vi.mock('./visit-service.js', () => ({
  ensureSessionVisitAssessment,
  isSessionEventPersisted,
  VisitAssessNotReadyError: class VisitAssessNotReadyError extends Error {
    code: string
    constructor(code: string, message?: string) {
      super(message ?? code)
      this.name = 'VisitAssessNotReadyError'
      this.code = code
    }
  },
}))

import {
  enqueueVisitAssessment,
  processVisitAssessQueueOnce,
  pushAnalyticsEventWithVisitAssess,
  VISIT_ASSESS_DEAD,
} from './visit-assess-queue.js'

describe('visit assess queue crash safety', () => {
  beforeEach(() => {
    stream.length = 0
    delayed.clear()
    dead.length = 0
    acked.clear()
    multiCalls.length = 0
    idSeq = 1
    ensureSessionVisitAssessment.mockReset()
    isSessionEventPersisted.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('atomically records event + assessment intent in one MULTI', async () => {
    await pushAnalyticsEventWithVisitAssess({
      eventPayload: JSON.stringify({ event_id: 'e1' }),
      assess: {
        workspaceId: '11111111-1111-4111-8111-111111111111',
        sessionId: 'session-abcdefgh',
        reason: 'behavior_summary',
        triggerEventId: '22222222-2222-4222-8222-222222222222',
        delayMs: 5_000,
      },
    })

    expect(multiCalls).toHaveLength(1)
    expect(multiCalls[0]!.map(([op]) => op)).toEqual(['lpush', 'zadd'])
    expect(delayed.size).toBe(1)
  })

  it('promotes delayed jobs atomically into the stream via Lua', async () => {
    const job = JSON.stringify({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      sessionId: 'session-abcdefgh',
      reason: 'page_leave',
      triggerEventId: '33333333-3333-4333-8333-333333333333',
      attempts: 0,
      notBeforeMs: Date.now() - 1,
      enqueuedAtMs: Date.now() - 10_000,
    })
    delayed.set(job, Date.now() - 1)
    isSessionEventPersisted.mockResolvedValue(true)
    ensureSessionVisitAssessment.mockResolvedValue({
      coverage: 'sufficient',
      findings: [],
      suspiciousVisit: false,
    })

    await processVisitAssessQueueOnce()
    expect(delayed.size).toBe(0)
    expect(ensureSessionVisitAssessment).toHaveBeenCalled()
  })

  it('does not ACK malformed jobs when dead-lettering fails', async () => {
    const { redis } = await import('../../services/redis.service.js')
    vi.mocked(redis.lpush).mockRejectedValueOnce(new Error('dlq down'))

    stream.push({
      id: 'bad-0',
      payload: '{not-json',
      idleMs: 0,
    })

    await expect(processVisitAssessQueueOnce()).rejects.toThrow('dlq down')
    expect(acked.has('bad-0')).toBe(false)
  })

  it('retries when the triggering event is not yet in ClickHouse', async () => {
    isSessionEventPersisted.mockResolvedValue(false)

    await enqueueVisitAssessment({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      sessionId: 'session-abcdefgh',
      reason: 'behavior_summary',
      triggerEventId: '44444444-4444-4444-8444-444444444444',
      delayMs: 0,
    })

    await processVisitAssessQueueOnce()
    expect(ensureSessionVisitAssessment).not.toHaveBeenCalled()
    expect(delayed.size).toBe(1)
    expect(dead).toHaveLength(0)
  })

  it('retries when visit risk persistence fails', async () => {
    isSessionEventPersisted.mockResolvedValue(true)
    ensureSessionVisitAssessment.mockRejectedValue(new Error('CH insert failed'))

    await enqueueVisitAssessment({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      sessionId: 'session-abcdefgh',
      reason: 'form_submit',
      triggerEventId: '55555555-5555-4555-8555-555555555555',
      delayMs: 0,
    })

    await processVisitAssessQueueOnce()
    expect(delayed.size).toBe(1)
    expect(dead).toHaveLength(0)
  })

  it('dead-letters exhausted jobs for inspection', async () => {
    isSessionEventPersisted.mockResolvedValue(false)

    stream.push({
      id: '10-0',
      payload: JSON.stringify({
        workspaceId: '11111111-1111-4111-8111-111111111111',
        sessionId: 'session-abcdefgh',
        reason: 'behavior_summary',
        triggerEventId: '66666666-6666-4666-8666-666666666666',
        attempts: 7,
        notBeforeMs: Date.now() - 1,
        enqueuedAtMs: Date.now() - 120_000,
      }),
      idleMs: 0,
    })

    await processVisitAssessQueueOnce()
    expect(dead).toHaveLength(1)
    expect(JSON.parse(dead[0]!).deadReason).toBe('max_attempts')
    expect(VISIT_ASSESS_DEAD).toBe('visit_assess_dead')
  })

  it('accepts insufficient coverage after retries instead of dead-lettering', async () => {
    isSessionEventPersisted.mockResolvedValue(true)
    ensureSessionVisitAssessment.mockResolvedValue({
      coverage: 'insufficient',
      findings: [{ code: 'visit_signals_incomplete' }],
      suspiciousVisit: false,
    })

    stream.push({
      id: '11-0',
      payload: JSON.stringify({
        workspaceId: '11111111-1111-4111-8111-111111111111',
        sessionId: 'session-abcdefgh',
        reason: 'sdk_connected',
        triggerEventId: '77777777-7777-4777-8777-777777777777',
        attempts: 7,
        notBeforeMs: Date.now() - 1,
        enqueuedAtMs: Date.now() - 120_000,
      }),
      idleMs: 0,
    })

    await processVisitAssessQueueOnce()
    expect(ensureSessionVisitAssessment).toHaveBeenCalled()
    expect(dead).toHaveLength(0)
    expect(delayed.size).toBe(0)
  })

  it('recovers jobs left in the PEL after worker death (no ack)', async () => {
    isSessionEventPersisted.mockResolvedValue(true)
    ensureSessionVisitAssessment.mockResolvedValue({
      coverage: 'sufficient',
      findings: [],
      suspiciousVisit: false,
    })

    stream.push({
      id: '9-0',
      payload: JSON.stringify({
        workspaceId: '11111111-1111-4111-8111-111111111111',
        sessionId: 'session-abcdefgh',
        reason: 'page_leave',
        triggerEventId: '33333333-3333-4333-8333-333333333333',
        attempts: 0,
        notBeforeMs: Date.now() - 1,
        enqueuedAtMs: Date.now() - 60_000,
      }),
      idleMs: 60_000,
    })

    await processVisitAssessQueueOnce()
    expect(ensureSessionVisitAssessment).toHaveBeenCalled()
    expect(acked.has('9-0')).toBe(true)
  })
})
