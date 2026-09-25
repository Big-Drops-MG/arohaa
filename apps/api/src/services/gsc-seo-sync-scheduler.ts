import type { FastifyBaseLogger } from 'fastify'
import { syncAllGscLandingPages } from './analytics-seo.service.js'

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000

let timer: NodeJS.Timeout | null = null
let running = false

export function startGscSeoSyncScheduler(options?: {
  logger?: FastifyBaseLogger
  intervalMs?: number
}): void {
  if (timer) return
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS
  const logger = options?.logger

  const tick = async () => {
    if (running) return
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return
    }
    running = true
    try {
      const result = await syncAllGscLandingPages()
      logger?.info(result, 'gsc seo daily sync finished')
    } catch (err) {
      logger?.error({ err }, 'gsc seo daily sync failed')
    } finally {
      running = false
    }
  }

  timer = setInterval(() => {
    void tick()
  }, intervalMs)
  timer.unref?.()

  setTimeout(() => {
    void tick()
  }, 60_000).unref?.()
}

export function stopGscSeoSyncScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
