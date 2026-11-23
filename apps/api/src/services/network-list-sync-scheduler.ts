import type { FastifyBaseLogger } from 'fastify'
import { syncNetworkLists } from './network-list-sync.service.js'

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000
const STARTUP_DELAY_MS = 90_000

let timer: NodeJS.Timeout | null = null
let startupTimer: NodeJS.Timeout | null = null
let running = false

export function startNetworkListSyncScheduler(options?: {
  logger?: FastifyBaseLogger
  intervalMs?: number
  startupDelayMs?: number
}): void {
  if (timer) return
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS
  const startupDelayMs = options?.startupDelayMs ?? STARTUP_DELAY_MS
  const logger = options?.logger

  const tick = async (reason: string) => {
    if (running) return
    if (process.env.AROHAA_NETWORK_LIST_SYNC_DISABLED === '1') {
      logger?.info('network list sync disabled via env')
      return
    }
    running = true
    try {
      const result = await syncNetworkLists()
      logger?.info({ ...result, reason }, 'network list daily sync finished')
    } catch (err) {
      logger?.error({ err, reason }, 'network list daily sync failed')
    } finally {
      running = false
    }
  }

  timer = setInterval(() => {
    void tick('interval')
  }, intervalMs)
  timer.unref?.()

  startupTimer = setTimeout(() => {
    void tick('startup')
  }, startupDelayMs)
  startupTimer.unref?.()
}

export function stopNetworkListSyncScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (startupTimer) {
    clearTimeout(startupTimer)
    startupTimer = null
  }
}
