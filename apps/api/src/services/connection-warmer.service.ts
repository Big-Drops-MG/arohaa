import type { FastifyBaseLogger } from 'fastify'
import { db, sql } from '@workspace/database'
import { redis } from './redis.service.js'
import { pingClickHouse, shouldSkipClickHouse } from './clickhouse.service.js'

const DEFAULT_INTERVAL_MS = 45_000
const WARM_PING_TIMEOUT_MS = 3_000

let timer: NodeJS.Timeout | null = null
let logger: FastifyBaseLogger | undefined

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw?.trim())
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

function isDisabled(): boolean {
  return process.env.CONNECTION_WARMER_DISABLED?.trim() === 'true'
}

async function warmPostgres(): Promise<boolean> {
  const timeout = new Promise<boolean>((resolve) =>
    setTimeout(() => resolve(false), WARM_PING_TIMEOUT_MS),
  )
  return Promise.race([
    db
      .execute(sql`SELECT 1 AS ok`)
      .then(() => true)
      .catch(() => false),
    timeout,
  ])
}

async function warmRedis(): Promise<boolean> {
  const timeout = new Promise<boolean>((resolve) =>
    setTimeout(() => resolve(false), WARM_PING_TIMEOUT_MS),
  )
  return Promise.race([
    redis
      .ping()
      .then(() => true)
      .catch(() => false),
    timeout,
  ])
}

async function warmConnections(reason: string): Promise<void> {
  const start = Date.now()
  try {
    const [clickhouse, redisUp, postgres] = await Promise.all([
      shouldSkipClickHouse()
        ? Promise.resolve(false)
        : pingClickHouse(WARM_PING_TIMEOUT_MS),
      warmRedis(),
      warmPostgres(),
    ])

    logger?.debug(
      {
        reason,
        clickhouse,
        redis: redisUp,
        postgres,
        latencyMs: Date.now() - start,
      },
      'connection warm sample',
    )
  } catch (err) {
    logger?.warn({ err, reason }, 'connection warm sample failed')
  }
}

export function startConnectionWarmer(options?: {
  logger?: FastifyBaseLogger
  intervalMs?: number
}): void {
  logger = options?.logger

  if (isDisabled()) {
    logger?.info('connection warmer disabled via CONNECTION_WARMER_DISABLED')
    return
  }

  const intervalMs = parsePositiveInt(
    process.env.CONNECTION_WARMER_INTERVAL_MS,
    options?.intervalMs ?? DEFAULT_INTERVAL_MS,
  )

  if (timer) return

  void warmConnections('startup')

  timer = setInterval(() => {
    void warmConnections('interval')
  }, intervalMs)

  if (typeof timer.unref === 'function') {
    timer.unref()
  }

  logger?.info({ intervalMs }, 'connection warmer started')
}

export function stopConnectionWarmer(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
