import { validateEvent, validateHeatmapEvent } from './validator.js'
import { logger } from '../logger.js'

const DLQ_KEY = 'failed_events'
const UNREPLAYABLE_KEY = 'failed_events_unreplayable'
const HEATMAP_QUEUE = 'heatmap_queue'
const ANALYTICS_QUEUE = 'analytics_queue'

const REPLAY_INTERVAL_MS = Number(process.env.FAILED_EVENTS_REPLAY_INTERVAL_MS || 15_000)
const REPLAY_BATCH_SIZE = Number(process.env.FAILED_EVENTS_REPLAY_BATCH || 20)

function extractEvents(entry) {
  const isHeatmap = entry.type === 'heatmap'
  const queue = isHeatmap ? HEATMAP_QUEUE : ANALYTICS_QUEUE

  if (Array.isArray(entry.events)) {
    return entry.events.map((event) => ({ event, queue, isHeatmap }))
  }
  if (typeof entry.payload === 'string') {
    return [{ event: JSON.parse(entry.payload), queue, isHeatmap }]
  }
  if (entry.payload && typeof entry.payload === 'object') {
    return [{ event: entry.payload, queue, isHeatmap }]
  }
  return []
}


export function startFailedEventsReplay(redis) {
  if (process.env.FAILED_EVENTS_REPLAY === '0') {
    logger.info('failed_events replay consumer disabled')
    return () => {}
  }

  let stopped = false
  let inFlight = false

  async function tick() {
    if (stopped || inFlight) return
    inFlight = true
    let replayed = 0
    let unreplayable = 0

    try {
      for (let i = 0; i < REPLAY_BATCH_SIZE; i++) {
        const raw = await redis.rpop(DLQ_KEY)
        if (!raw) break

        let entry
        try {
          entry = JSON.parse(raw)
        } catch {
          await redis.lpush(
            UNREPLAYABLE_KEY,
            JSON.stringify({
              reason: 'unparseable',
              payload: raw,
              timestamp: Date.now(),
            }),
          )
          unreplayable += 1
          continue
        }

        let items
        try {
          items = extractEvents(entry)
        } catch {
          await redis.lpush(
            UNREPLAYABLE_KEY,
            JSON.stringify({
              reason: 'extract_failed',
              entry,
              timestamp: Date.now(),
            }),
          )
          unreplayable += 1
          continue
        }

        if (items.length === 0) {
          await redis.lpush(
            UNREPLAYABLE_KEY,
            JSON.stringify({
              reason: 'empty_entry',
              entry,
              timestamp: Date.now(),
            }),
          )
          unreplayable += 1
          continue
        }

        for (const item of items) {
          const ok = item.isHeatmap
            ? validateHeatmapEvent(item.event)
            : validateEvent(item.event)
          if (!ok) {
            await redis.lpush(
              UNREPLAYABLE_KEY,
              JSON.stringify({
                reason: 'validation_failed',
                event: item.event,
                type: item.isHeatmap ? 'heatmap' : 'analytics',
                timestamp: Date.now(),
              }),
            )
            unreplayable += 1
            continue
          }

          await redis.lpush(item.queue, JSON.stringify(item.event))
          replayed += 1
        }
      }

      if (replayed > 0 || unreplayable > 0) {
        logger.info(
          { replayed, unreplayable },
          'failed_events replay tick',
        )
      }
    } catch (err) {
      logger.error({ err }, 'failed_events replay tick failed')
    } finally {
      inFlight = false
    }
  }

  const timer = setInterval(() => {
    void tick()
  }, REPLAY_INTERVAL_MS)
  if (typeof timer.unref === 'function') timer.unref()

  void tick()

  return () => {
    stopped = true
    clearInterval(timer)
  }
}
