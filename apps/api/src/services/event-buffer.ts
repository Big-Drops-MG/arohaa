import * as Sentry from '@sentry/node'
import type { FastifyBaseLogger } from 'fastify'
import { redis } from './redis.service.js'
import type { EventRow } from '../types/event.js'
import {
  eventRowToHeatmapRow,
  isHeatmapOnlyEvent,
  shouldRouteToHeatmapQueue,
  type HeatmapRow,
} from './heatmap-route.js'

const FLUSH_INTERVAL_MS = 5000
const FLUSH_SIZE_THRESHOLD = 1000
const MAX_BUFFER_SIZE = 10_000

const PRIORITY_EVENT_NAMES = new Set([
  'form_success',
  'form_step_complete',
  'form_submit',
  'zip_submit',
])

const HEATMAP_FLUSH_INTERVAL_MS = 2000
const HEATMAP_FLUSH_SIZE_THRESHOLD = 5000
const MAX_HEATMAP_BUFFER_SIZE = 20_000

interface BufferOptions {
  logger?: FastifyBaseLogger
  flushIntervalMs?: number
  flushSizeThreshold?: number
}

let buffer: EventRow[] = []
let heatmapBuffer: HeatmapRow[] = []
let timer: NodeJS.Timeout | null = null
let heatmapTimer: NodeJS.Timeout | null = null
let flushInFlight: Promise<void> | null = null
let heatmapFlushInFlight: Promise<void> | null = null
let logger: FastifyBaseLogger | undefined
let flushIntervalMs = FLUSH_INTERVAL_MS
let flushSizeThreshold = FLUSH_SIZE_THRESHOLD

class QueueUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QueueUnavailableError'
  }
}

async function awaitDlq(entry: Record<string, unknown>): Promise<void> {
  await redis.lpush('failed_events', JSON.stringify(entry))
}

function pushPriorityEvent(row: EventRow): Promise<void> {
  return redis.lpush('analytics_queue', JSON.stringify(row)).then(() => {
    logger?.info(
      { event_name: row.event_name, traceId: row.trace_id },
      'priority event pushed to redis',
    )
  })
}

async function pushHeatmapDurable(row: EventRow): Promise<void> {
  const mapped = eventRowToHeatmapRow(row)
  if (!mapped) {
    logger?.warn(
      { event_name: row.event_name, traceId: row.trace_id },
      'heatmap event could not be mapped; dropping',
    )
    return
  }

  await redis.lpush('heatmap_queue', JSON.stringify(mapped))
}

async function pushAnalyticsDurable(row: EventRow): Promise<void> {
  await redis.lpush('analytics_queue', JSON.stringify(row))
}

export async function pushEvent(row: EventRow): Promise<void> {
  try {
    if (shouldRouteToHeatmapQueue(row)) {
      await pushHeatmapDurable(row)
      if (isHeatmapOnlyEvent(row)) return
    }

    if (PRIORITY_EVENT_NAMES.has(row.event_name)) {
      await pushPriorityEvent(row)
      return
    }

    await pushAnalyticsDurable(row)
  } catch (err) {
    logger?.error(
      { err, event_name: row.event_name, traceId: row.trace_id },
      'redis push failed; rejecting ingest (no silent buffer drop)',
    )
    Sentry.captureException(err, {
      tags: { component: 'event-buffer', reason: 'durable_push' },
    })
    throw err instanceof Error ? err : new QueueUnavailableError(String(err))
  }
}

export function getBufferSize(): number {
  return buffer.length
}

export function getHeatmapBufferSize(): number {
  return heatmapBuffer.length
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

export async function flushHeatmap(reason: string = 'manual'): Promise<void> {
  if (heatmapFlushInFlight) {
    await heatmapFlushInFlight
    return
  }

  if (heatmapBuffer.length === 0) return

  heatmapFlushInFlight = doHeatmapFlush(reason).finally(() => {
    heatmapFlushInFlight = null
  })

  await heatmapFlushInFlight
}

async function doFlush(reason: string): Promise<void> {
  if (buffer.length === 0) return

  const batch = buffer
  buffer = []

  const startedAt = Date.now()
  try {
    const payloads = batch.map((row) => JSON.stringify(row))
    await redis.lpush('analytics_queue', ...payloads)

    logger?.info(
      {
        reason,
        rows: batch.length,
        durationMs: Date.now() - startedAt,
      },
      'flushed events to redis queue',
    )
  } catch (err) {
    const remainingHeadroom = MAX_BUFFER_SIZE - buffer.length
    const requeue = batch.slice(0, Math.max(0, remainingHeadroom))
    const overflow = batch.slice(requeue.length)
    buffer = requeue.concat(buffer)

    if (overflow.length > 0) {
      try {
        await awaitDlq({
          reason: 'api_analytics_flush_overflow',
          events: overflow,
          error: err instanceof Error ? err.message : String(err),
          timestamp: Date.now(),
        })
      } catch (dlqErr) {
        logger?.error(
          { err: dlqErr, droppedRows: overflow.length },
          'failed to DLQ overflow analytics events',
        )
        Sentry.captureException(dlqErr, {
          tags: { component: 'event-buffer', reason: 'analytics_dlq' },
        })
      }
    }

    logger?.error(
      {
        err,
        reason,
        attemptedRows: batch.length,
        requeuedRows: requeue.length,
        dlqRows: overflow.length,
      },
      'redis push failed; events requeued or sent to DLQ',
    )

    Sentry.captureException(err, {
      tags: { component: 'redis-push', reason },
      contexts: {
        flush: {
          attemptedRows: batch.length,
          requeuedRows: requeue.length,
          dlqRows: overflow.length,
        },
      },
    })
  }
}

async function doHeatmapFlush(reason: string): Promise<void> {
  if (heatmapBuffer.length === 0) return

  const batch = heatmapBuffer
  heatmapBuffer = []

  const startedAt = Date.now()
  try {
    const payloads = batch.map((row) => JSON.stringify(row))
    await redis.lpush('heatmap_queue', ...payloads)

    logger?.info(
      {
        reason,
        rows: batch.length,
        durationMs: Date.now() - startedAt,
      },
      'flushed heatmap events to redis queue',
    )
  } catch (err) {
    const remainingHeadroom = MAX_HEATMAP_BUFFER_SIZE - heatmapBuffer.length
    const requeue = batch.slice(0, Math.max(0, remainingHeadroom))
    const overflow = batch.slice(requeue.length)
    heatmapBuffer = requeue.concat(heatmapBuffer)

    if (overflow.length > 0) {
      try {
        await awaitDlq({
          reason: 'api_heatmap_flush_overflow',
          events: overflow,
          error: err instanceof Error ? err.message : String(err),
          timestamp: Date.now(),
          type: 'heatmap',
        })
      } catch (dlqErr) {
        logger?.error(
          { err: dlqErr, droppedRows: overflow.length },
          'failed to DLQ overflow heatmap events',
        )
        Sentry.captureException(dlqErr, {
          tags: { component: 'event-buffer', reason: 'heatmap_dlq' },
        })
      }
    }

    logger?.error(
      {
        err,
        reason,
        attemptedRows: batch.length,
        requeuedRows: requeue.length,
        dlqRows: overflow.length,
      },
      'redis heatmap push failed; events requeued or sent to DLQ',
    )

    Sentry.captureException(err, {
      tags: { component: 'redis-heatmap-push', reason },
    })
  }
}

function scheduleFlush(reason: string): Promise<void> {
  return flush(reason).catch((err) => {
    logger?.error({ err, reason }, 'scheduled flush failed unexpectedly')
  })
}

function scheduleHeatmapFlush(reason: string): Promise<void> {
  return flushHeatmap(reason).catch((err) => {
    logger?.error({ err, reason }, 'scheduled heatmap flush failed unexpectedly')
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

  heatmapTimer = setInterval(() => {
    void scheduleHeatmapFlush('interval')
  }, HEATMAP_FLUSH_INTERVAL_MS)
  if (typeof heatmapTimer.unref === 'function') {
    heatmapTimer.unref()
  }

  logger?.info(
    {
      flushIntervalMs,
      flushSizeThreshold,
      maxBufferSize: MAX_BUFFER_SIZE,
      heatmapFlushIntervalMs: HEATMAP_FLUSH_INTERVAL_MS,
      heatmapFlushSizeThreshold: HEATMAP_FLUSH_SIZE_THRESHOLD,
    },
    'event buffer processor started',
  )
}

export async function stopBufferProcessor(): Promise<void> {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (heatmapTimer) {
    clearInterval(heatmapTimer)
    heatmapTimer = null
  }
  await Promise.all([flush('shutdown'), flushHeatmap('shutdown')])
}