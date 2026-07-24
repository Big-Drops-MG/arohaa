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

let bufferFullReportedAt = 0
const BUFFER_FULL_REPORT_COOLDOWN_MS = 60_000

function pushHeatmap(row: EventRow): void {
  const mapped = eventRowToHeatmapRow(row)
  if (!mapped) {
    logger?.warn(
      { event_name: row.event_name, traceId: row.trace_id },
      'heatmap event could not be mapped; dropping',
    )
    return
  }

  if (heatmapBuffer.length >= MAX_HEATMAP_BUFFER_SIZE) {
    logger?.warn(
      { bufferSize: heatmapBuffer.length, traceId: row.trace_id },
      'heatmap buffer is full; dropping event',
    )
    void redis
      .lpush(
        'failed_events',
        JSON.stringify({
          reason: 'api_heatmap_buffer_full',
          payload: mapped,
          timestamp: Date.now(),
          type: 'heatmap',
        }),
      )
      .catch(() => {})
    return
  }

  heatmapBuffer.push(mapped)

  if (heatmapBuffer.length >= HEATMAP_FLUSH_SIZE_THRESHOLD) {
    void scheduleHeatmapFlush('size_threshold')
  }
}

export function pushEvent(row: EventRow): void {
  if (shouldRouteToHeatmapQueue(row)) {
    pushHeatmap(row)
    if (isHeatmapOnlyEvent(row)) return
  }

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

    void redis
      .lpush(
        'failed_events',
        JSON.stringify({
          reason: 'api_buffer_full',
          payload: row,
          timestamp: Date.now(),
        }),
      )
      .catch(() => {})
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
      'redis push failed; events requeued',
    )

    Sentry.captureException(err, {
      tags: { component: 'redis-push', reason },
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
    heatmapBuffer = requeue.concat(heatmapBuffer)

    logger?.error(
      {
        err,
        reason,
        attemptedRows: batch.length,
        requeuedRows: requeue.length,
      },
      'redis heatmap push failed; events requeued',
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
