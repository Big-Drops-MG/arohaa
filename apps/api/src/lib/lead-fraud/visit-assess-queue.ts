import { randomUUID } from 'node:crypto'
import { redis } from '../../services/redis.service.js'
import {
  ensureSessionVisitAssessment,
  isSessionEventPersisted,
  VisitAssessNotReadyError,
} from './visit-service.js'

export const VISIT_ASSESS_STREAM = 'visit_assess_stream'
export const VISIT_ASSESS_GROUP = 'visit_assess_workers'
export const VISIT_ASSESS_DELAYED = 'visit_assess_delayed'
export const VISIT_ASSESS_DEAD = 'visit_assess_dead'

export type VisitAssessJob = {
  workspaceId: string
  sessionId: string
  tenantWorkspaceId?: string
  triggerEventId?: string
  attempts: number
  notBeforeMs: number
  enqueuedAtMs: number
  reason: string
}

export type VisitAssessEnqueueInput = {
  workspaceId: string
  sessionId: string
  tenantWorkspaceId?: string
  reason: string
  triggerEventId?: string
  delayMs?: number
  attempts?: number
}

const MAX_ATTEMPTS = 8
const INITIAL_DELAY_MS = 5_000
const POLL_MS = 2_000
const STALE_IDLE_MS = 60_000
const CONSUMER =
  typeof process !== 'undefined'
    ? `api-${process.pid}-${randomUUID().slice(0, 8)}`
    : `api-${randomUUID().slice(0, 8)}`

const PROMOTE_DELAYED_LUA = `
local ready = redis.call('ZRANGEBYSCORE', KEYS[1], 0, ARGV[1], 'LIMIT', 0, tonumber(ARGV[2]))
local moved = 0
for _, member in ipairs(ready) do
  if redis.call('ZREM', KEYS[1], member) == 1 then
    redis.call('XADD', KEYS[2], '*', 'payload', member)
    moved = moved + 1
  end
end
return moved
`

let timer: ReturnType<typeof setInterval> | null = null
let running = false
let groupReady = false

function backoffMs(attempts: number): number {
  return Math.min(60_000, INITIAL_DELAY_MS * 2 ** Math.min(attempts, 5))
}

function serializeJob(job: VisitAssessJob): string {
  return JSON.stringify(job)
}

function parseJob(raw: string): VisitAssessJob | null {
  try {
    const job = JSON.parse(raw) as VisitAssessJob
    if (!job || typeof job !== 'object') return null
    if (typeof job.workspaceId !== 'string' || typeof job.sessionId !== 'string') {
      return null
    }
    return job
  } catch {
    return null
  }
}

function buildJob(input: VisitAssessEnqueueInput): VisitAssessJob | null {
  const workspaceId = input.workspaceId.trim()
  const sessionId = input.sessionId.trim()
  if (!workspaceId || !sessionId) return null

  const delayMs = input.delayMs ?? INITIAL_DELAY_MS
  return {
    workspaceId,
    sessionId,
    tenantWorkspaceId: input.tenantWorkspaceId,
    triggerEventId: input.triggerEventId?.trim() || undefined,
    attempts: input.attempts ?? 0,
    notBeforeMs: Date.now() + delayMs,
    enqueuedAtMs: Date.now(),
    reason: input.reason,
  }
}

async function ensureConsumerGroup(): Promise<void> {
  if (groupReady) return
  try {
    await redis.xgroup(
      'CREATE',
      VISIT_ASSESS_STREAM,
      VISIT_ASSESS_GROUP,
      '0',
      'MKSTREAM',
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!msg.includes('BUSYGROUP')) throw err
  }
  groupReady = true
}

async function deadLetter(
  job: VisitAssessJob | Record<string, unknown>,
  reason: string,
): Promise<void> {
  const entry = JSON.stringify({
    ...job,
    deadAtMs: Date.now(),
    deadReason: reason,
  })
  await redis.lpush(VISIT_ASSESS_DEAD, entry)
}


export async function enqueueVisitAssessment(
  input: VisitAssessEnqueueInput,
): Promise<void> {
  const job = buildJob(input)
  if (!job) return

  const delayMs = input.delayMs ?? INITIAL_DELAY_MS
  const raw = serializeJob(job)

  try {
    if (delayMs > 0) {
      await redis.zadd(VISIT_ASSESS_DELAYED, job.notBeforeMs, raw)
      return
    }

    await ensureConsumerGroup()
    await redis.xadd(VISIT_ASSESS_STREAM, '*', 'payload', raw)
  } catch (err) {
    try {
      await deadLetter(job, 'enqueue_failed')
    } catch (dlqErr) {
      console.error(
        '[visit-assess-queue] dead-letter after enqueue failure',
        dlqErr,
      )
    }
    throw err
  }
}


export async function pushAnalyticsEventWithVisitAssess(input: {
  eventPayload: string
  assess: VisitAssessEnqueueInput
  queueKey?: string
}): Promise<void> {
  const job = buildJob(input.assess)
  if (!job) {
    await redis.lpush(input.queueKey ?? 'analytics_queue', input.eventPayload)
    return
  }

  const multi = redis.multi()
  multi.lpush(input.queueKey ?? 'analytics_queue', input.eventPayload)
  multi.zadd(VISIT_ASSESS_DELAYED, job.notBeforeMs, serializeJob(job))
  const results = await multi.exec()
  if (!results) {
    throw new Error('redis multi returned null for event+assess handoff')
  }
  for (const [err] of results) {
    if (err) throw err
  }
}

async function scheduleRetry(job: VisitAssessJob, delayMs: number): Promise<void> {
  await enqueueVisitAssessment({
    workspaceId: job.workspaceId,
    sessionId: job.sessionId,
    tenantWorkspaceId: job.tenantWorkspaceId,
    reason: job.reason,
    triggerEventId: job.triggerEventId,
    delayMs,
    attempts: job.attempts + 1,
  })
}

async function promoteDelayedJobs(limit = 40): Promise<number> {
  await ensureConsumerGroup()
  const moved = await redis.eval(
    PROMOTE_DELAYED_LUA,
    2,
    VISIT_ASSESS_DELAYED,
    VISIT_ASSESS_STREAM,
    String(Date.now()),
    String(limit),
  )
  return Number(moved) || 0
}

type StreamEntry = [string, string[]]

function payloadFromFields(fields: string[]): string | null {
  for (let i = 0; i < fields.length - 1; i += 2) {
    if (fields[i] === 'payload') return fields[i + 1] ?? null
  }
  return null
}

async function claimStalePending(limit = 20): Promise<StreamEntry[]> {
  try {
    const result = (await redis.xautoclaim(
      VISIT_ASSESS_STREAM,
      VISIT_ASSESS_GROUP,
      CONSUMER,
      STALE_IDLE_MS,
      '0-0',
      'COUNT',
      limit,
    )) as unknown

    if (!Array.isArray(result) || result.length < 2) return []
    const messages = result[1]
    if (!Array.isArray(messages)) return []
    return messages as StreamEntry[]
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('NOGROUP') || msg.includes('ERR')) {
      groupReady = false
      await ensureConsumerGroup()
    }
    return []
  }
}

async function readNewMessages(limit = 20): Promise<StreamEntry[]> {
  const result = (await redis.xreadgroup(
    'GROUP',
    VISIT_ASSESS_GROUP,
    CONSUMER,
    'COUNT',
    limit,
    'STREAMS',
    VISIT_ASSESS_STREAM,
    '>',
  )) as Array<[string, StreamEntry[]]> | null

  if (!result?.length) return []
  const entries: StreamEntry[] = []
  for (const [, messages] of result) {
    if (messages?.length) entries.push(...messages)
  }
  return entries
}

async function ack(messageId: string): Promise<void> {
  await redis.xack(VISIT_ASSESS_STREAM, VISIT_ASSESS_GROUP, messageId)
}

async function handleJob(job: VisitAssessJob): Promise<'done' | 'retry' | 'dead'> {
  if (job.triggerEventId) {
    const ready = await isSessionEventPersisted({
      workspaceId: job.workspaceId,
      sessionId: job.sessionId,
      eventId: job.triggerEventId,
    })
    if (!ready) {
      if (job.attempts + 1 >= MAX_ATTEMPTS) return 'dead'
      return 'retry'
    }
  }

  try {
    const assessment = await ensureSessionVisitAssessment({
      workspaceId: job.workspaceId,
      sessionId: job.sessionId,
      tenantWorkspaceId: job.tenantWorkspaceId,
      triggerEventId: job.triggerEventId,
    })
    // Incomplete coverage is a valid terminal outcome (coverage loss, not fraud).
    // Retry briefly so early triggers (e.g. sdk_connected) can wait for richer
    // signals; after max attempts keep the persisted insufficient assessment.
    const incomplete =
      assessment.coverage === 'insufficient' &&
      assessment.findings.some((f) => f.code === 'visit_signals_incomplete')
    if (incomplete && job.attempts + 1 < MAX_ATTEMPTS) {
      return 'retry'
    }
    return 'done'
  } catch (err) {
    if (err instanceof VisitAssessNotReadyError) {
      if (job.attempts + 1 >= MAX_ATTEMPTS) return 'dead'
      return 'retry'
    }
    console.error('[visit-assess-queue] assessment failed', err)
    if (job.attempts + 1 >= MAX_ATTEMPTS) return 'dead'
    return 'retry'
  }
}

async function processEntries(entries: StreamEntry[]): Promise<number> {
  let processed = 0
  for (const [messageId, fields] of entries) {
    const raw = payloadFromFields(fields)
    const job = raw ? parseJob(raw) : null
    if (!job) {
      await deadLetter(
        {
          workspaceId: '',
          sessionId: '',
          attempts: 0,
          notBeforeMs: 0,
          enqueuedAtMs: Date.now(),
          reason: 'invalid_payload',
          raw: raw ?? null,
        },
        'invalid_payload',
      )
      await ack(messageId)
      continue
    }

    processed += 1
    const outcome = await handleJob(job)
    if (outcome === 'retry') {
      await scheduleRetry(job, backoffMs(job.attempts))
      await ack(messageId)
      continue
    }
    if (outcome === 'dead') {
      await deadLetter(job, 'max_attempts')
      await ack(messageId)
      continue
    }
    await ack(messageId)
  }
  return processed
}

export async function processVisitAssessQueueOnce(): Promise<number> {
  await ensureConsumerGroup()
  await promoteDelayedJobs()
  const stale = await claimStalePending()
  const fresh = await readNewMessages()
  return (await processEntries(stale)) + (await processEntries(fresh))
}

export function startVisitAssessQueueProcessor(): void {
  if (timer) return
  timer = setInterval(() => {
    if (running) return
    running = true
    void processVisitAssessQueueOnce()
      .catch((err) => {
        console.error('[visit-assess-queue] tick failed', err)
      })
      .finally(() => {
        running = false
      })
  }, POLL_MS)
  if (typeof timer === 'object' && timer && 'unref' in timer) {
    try {
      timer.unref()
    } catch {
      /* ignore */
    }
  }
}

export function stopVisitAssessQueueProcessor(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

export const __visitAssessQueueTest = {
  CONSUMER,
  MAX_ATTEMPTS,
  STALE_IDLE_MS,
  INITIAL_DELAY_MS,
  PROMOTE_DELAYED_LUA,
  backoffMs,
  buildJob,
  parseJob,
}
