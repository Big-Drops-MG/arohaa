import * as Sentry from '@sentry/node'
import type { FastifyBaseLogger } from 'fastify'
import { insertEvents } from './clickhouse.service.js'
import type { EventRow } from '../types/event.js'

const FLUSH_INTERVAL_MS = 5000
const FLUSH_SIZE_THRESHOLD = 1000
const MAX_BUFFER_SIZE = 10_000

interface BufferOptions {
  logger?: FastifyBaseLogger
  flushIntervalMs?: number
  flushSizeThreshold?: number
}

let buffer: EventRow[] = []
let timer: NodeJS.Timeout | null = null
let flushInFlight: Promise<void> | null = null
let logger: FastifyBaseLogger | undefined
let flushIntervalMs = FLUSH_INTERVAL_MS
let flushSizeThreshold = FLUSH_SIZE_THRESHOLD

let bufferFullReportedAt = 0
const BUFFER_FULL_REPORT_COOLDOWN_MS = 60_000

export function pushEvent(row: EventRow): void {
  if (buffer.length >= MAX_BUFFER_SIZE) {
    logger?.warn(
      { bufferSize: buffer.length, traceId: row.trace_id },
      'event buffer is full; dropping event',
    )

    const now = Date.now()
    if (now - bufferFullReportedAt > BUFFER_FULL_REPORT_COOLDOWN_MS) {
      bufferFullReportedAt = now
      Sentry.captureMessage('event buffer is full; dropping events', {
        level: 'error',
        tags: { component: 'event-buffer' },
        contexts: {
          buffer: {
            size: buffer.length,
            max: MAX_BUFFER_SIZE,
          },
        },
      })
    }
    return
  }

  buffer.push(row)

  if (buffer.length >= flushSizeThreshold) {
    void scheduleFlush('size_threshold')
  }
}

export function getBufferSize(): number {
  return buffer.length
}

export async function flush(reason: string = 'manual'): Promise<void> {
  if (flushInFlight) {
    await flushInFlight
    return
  }

  if (buffer.length === 0) return

  flushInFlight = doFlush(reason).finally(() => {
    flushInFlight = null
  })

  await flushInFlight
}

async function doFlush(reason: string): Promise<void> {
  const batch = buffer
  buffer = []

  const startedAt = Date.now()
  try {
    await insertEvents(batch)
    logger?.info(
      {
        reason,
        rows: batch.length,
        durationMs: Date.now() - startedAt,
      },
      'flushed events to clickhouse',
    )
  } catch (err) {
    const remainingHeadroom = MAX_BUFFER_SIZE - buffer.length
    const requeue = batch.slice(0, Math.max(0, remainingHeadroom))
    const droppedRows = batch.length - requeue.length
    buffer = requeue.concat(buffer)
    logger?.error(
      {
        err,
        reason,
        attemptedRows: batch.length,
        requeuedRows: requeue.length,
        droppedRows,
      },
      'clickhouse insert failed; events requeued',
    )

    Sentry.captureException(err, {
      tags: { component: 'clickhouse-insert', reason },
      contexts: {
        flush: {
          attemptedRows: batch.length,
          requeuedRows: requeue.length,
          droppedRows,
        },
      },
    })
  }
}

function scheduleFlush(reason: string): Promise<void> {
  return flush(reason).catch((err) => {
    logger?.error({ err, reason }, 'scheduled flush failed unexpectedly')
  })
}

export function startBufferProcessor(options: BufferOptions = {}): void {
  logger = options.logger
  flushIntervalMs = options.flushIntervalMs ?? FLUSH_INTERVAL_MS
  flushSizeThreshold = options.flushSizeThreshold ?? FLUSH_SIZE_THRESHOLD

  if (timer) return

  timer = setInterval(() => {
    void scheduleFlush('interval')
  }, flushIntervalMs)
  if (typeof timer.unref === 'function') {
    timer.unref()
  }

  logger?.info(
    { flushIntervalMs, flushSizeThreshold, maxBufferSize: MAX_BUFFER_SIZE },
    'event buffer processor started',
  )
}

export async function stopBufferProcessor(): Promise<void> {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  await flush('shutdown')
}
