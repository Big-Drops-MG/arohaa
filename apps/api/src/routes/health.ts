import type { FastifyInstance } from 'fastify'
import { CLICKHOUSE_EVENTS_TABLE } from '../lib/clickhouse-events-table.js'
import {
  getClickHouseClient,
  pingClickHouse,
  shouldSkipClickHouse,
} from '../services/clickhouse.service.js'
import { redis } from '../services/redis.service.js'
import { sendAlertWebhook } from '../lib/alert-webhook.js'
import { verifyInternalApiRequest } from '../lib/internal-api-secret.js'
import { db, sql } from '@workspace/database'

const PING_TIMEOUT_MS = 3000
const HEALTH_RATE_LIMIT_OPT_OUT = { rateLimit: false } as const

async function timedCheck(
  fn: () => Promise<boolean>,
  timeoutMs: number,
): Promise<{ status: 'ok' | 'unreachable'; latency_ms: number }> {
  const start = Date.now()
  const timeout = new Promise<boolean>((resolve) =>
    setTimeout(() => resolve(false), timeoutMs),
  )
  const ok = await Promise.race([fn().catch(() => false), timeout])
  return { status: ok ? 'ok' : 'unreachable', latency_ms: Date.now() - start }
}

export async function healthRoutes(server: FastifyInstance) {
  server.get(
    '/health',
    { config: HEALTH_RATE_LIMIT_OPT_OUT },
    async () => ({ status: 'ok' }),
  )

  server.get(
    '/health/ready',
    { config: HEALTH_RATE_LIMIT_OPT_OUT },
    async (request, reply) => {
      try {
        const start = Date.now()

        const timeoutPromise = new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), PING_TIMEOUT_MS),
        )

        const [isClickHouseUp, isRedisUp, isPostgresUp, queueLen, dlqLen] =
          await Promise.all([
            pingClickHouse(PING_TIMEOUT_MS),
            Promise.race([
              redis.ping().then(() => true).catch(() => false),
              timeoutPromise,
            ]),
            Promise.race([
              db.execute(sql`SELECT 1 AS ok`).then(() => true).catch(() => false),
              timeoutPromise,
            ]),
            redis.llen('analytics_queue').catch(() => -1),
            redis.llen('failed_events').catch(() => -1),
          ])

        const latencyMs = Date.now() - start

        if (!isClickHouseUp || !isRedisUp || !isPostgresUp) {
          void sendAlertWebhook({
            title: 'API readiness check failed',
            body: `clickhouse=${isClickHouseUp ? 'ok' : 'down'}, redis=${isRedisUp ? 'ok' : 'down'}, postgres=${isPostgresUp ? 'ok' : 'down'}, queue=${queueLen}, dlq=${dlqLen}`,
            severity: 'warning',
            source: 'api.health.ready',
          })

          return reply.status(503).send({
            status: 'error',
            service: 'arohaa-ingestion-api',
            dependencies: {
              clickhouse: isClickHouseUp ? 'ok' : 'unreachable',
              redis: isRedisUp ? 'ok' : 'unreachable',
              postgres: isPostgresUp ? 'ok' : 'unreachable',
            },
            queues: {
              analytics_queue: queueLen,
              failed_events: dlqLen,
            },
            latency_ms: latencyMs,
            trace_id: request.id,
          })
        }

        return {
          status: 'ok',
          service: 'arohaa-ingestion-api',
          dependencies: {
            clickhouse: 'ok',
            redis: 'ok',
            postgres: 'ok',
          },
          queues: {
            analytics_queue: queueLen,
            failed_events: dlqLen,
          },
          latency_ms: latencyMs,
          timestamp: new Date().toISOString(),
          trace_id: request.id,
        }
      } catch {
        return reply.status(503).send({
          status: 'error',
          service: 'arohaa-ingestion-api',
          reason: 'health_check_failed',
          trace_id: request.id,
        })
      }
    },
  )

  server.get(
    '/health/metrics',
    { config: HEALTH_RATE_LIMIT_OPT_OUT },
    async (_request, reply) => {
      if (shouldSkipClickHouse()) {
        return reply.status(503).send({ status: 'error', reason: 'clickhouse_backoff' })
      }

      try {
        const ch = getClickHouseClient()
        const result = await ch.query({
          query: `
            SELECT
              count() AS events_total,
              countIf(created_at >= now() - INTERVAL 1 HOUR) AS events_last_hour,
              countIf(created_at >= now() - INTERVAL 24 HOUR) AS events_last_24h
            FROM ${CLICKHOUSE_EVENTS_TABLE}
          `,
          format: 'JSON',
        })
        const json = (await result.json()) as {
          data: Array<{
            events_total: string | number
            events_last_hour: string | number
            events_last_24h: string | number
          }>
        }
        const row = json.data[0]
        const [queueLen, dlqLen] = await Promise.all([
          redis.llen('analytics_queue').catch(() => -1),
          redis.llen('failed_events').catch(() => -1),
        ])

        return {
          status: 'ok',
          events: {
            total: Number(row?.events_total ?? 0),
            last_hour: Number(row?.events_last_hour ?? 0),
            last_24h: Number(row?.events_last_24h ?? 0),
          },
          queues: {
            analytics_queue: queueLen,
            failed_events: dlqLen,
          },
          timestamp: new Date().toISOString(),
        }
      } catch {
        return reply.status(503).send({ status: 'error', reason: 'metrics_unavailable' })
      }
    },
  )

  server.get(
    '/health/detailed',
    { config: HEALTH_RATE_LIMIT_OPT_OUT },
    async (request) => {
      const [clickhouse, redisCheck, postgres, queueLen, dlqLen] =
        await Promise.all([
          timedCheck(() => pingClickHouse(PING_TIMEOUT_MS), PING_TIMEOUT_MS),
          timedCheck(() => redis.ping().then(() => true), PING_TIMEOUT_MS),
          timedCheck(
            () => db.execute(sql`SELECT 1 AS ok`).then(() => true),
            PING_TIMEOUT_MS,
          ),
          redis.llen('analytics_queue').catch(() => -1),
          redis.llen('failed_events').catch(() => -1),
        ])

      const mem = process.memoryUsage()
      const toMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10

      const allOk =
        clickhouse.status === 'ok' &&
        redisCheck.status === 'ok' &&
        postgres.status === 'ok'

      return {
        status: allOk ? 'ok' : 'degraded',
        service: 'arohaa-ingestion-api',
        version: process.env.API_VERSION?.trim() || process.env.GIT_SHA?.trim() || 'unknown',
        environment: process.env.NODE_ENV || 'development',
        region: process.env.AWS_REGION?.trim() || 'unknown',
        uptime_s: Math.round(process.uptime()),
        dependencies: {
          clickhouse: clickhouse,
          redis: redisCheck,
          postgres: postgres,
        },
        queues: {
          analytics_queue: queueLen,
          failed_events: dlqLen,
        },
        system: {
          node: process.version,
          pid: process.pid,
          memory_rss_mb: toMb(mem.rss),
          memory_heap_used_mb: toMb(mem.heapUsed),
          memory_heap_total_mb: toMb(mem.heapTotal),
        },
        timestamp: new Date().toISOString(),
        trace_id: request.id,
      }
    },
  )

  server.get<{ Querystring: { limit?: string } }>(
    '/health/queues',
    { config: HEALTH_RATE_LIMIT_OPT_OUT },
    async (request, reply) => {
      if (!verifyInternalApiRequest(request.headers['x-arohaa-internal'])) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const parsedLimit = Number(request.query.limit)
      const limit = Number.isFinite(parsedLimit)
        ? Math.min(Math.max(Math.floor(parsedLimit), 1), 100)
        : 20

      const truncate = (value: string) =>
        value.length > 4000 ? `${value.slice(0, 4000)}…` : value

      const pick = (obj: Record<string, unknown>, key: string): string | null => {
        const v = obj[key]
        return typeof v === 'string' || typeof v === 'number' ? String(v) : null
      }

      const mapQueueItem = (raw: string) => {
        try {
          const obj = JSON.parse(raw) as Record<string, unknown>
          return {
            event_name: pick(obj, 'event_name'),
            url: pick(obj, 'url'),
            workspace_id: pick(obj, 'workspace_id'),
            created_at: pick(obj, 'created_at'),
            json: truncate(raw),
          }
        } catch {
          return {
            event_name: null,
            url: null,
            workspace_id: null,
            created_at: null,
            json: truncate(raw),
          }
        }
      }

      const mapFailedItem = (raw: string) => {
        try {
          const obj = JSON.parse(raw) as Record<string, unknown>
          const reason =
            pick(obj, 'reason') ?? (obj.error ? 'batch_error' : 'unknown')
          const ts = obj.timestamp
          return {
            reason,
            timestamp: typeof ts === 'number' ? ts : null,
            json: truncate(raw),
          }
        } catch {
          return { reason: 'unparseable', timestamp: null, json: truncate(raw) }
        }
      }

      try {
        const [queueDepth, dlqDepth, queueRaw, dlqRaw] = await Promise.all([
          redis.llen('analytics_queue').catch(() => -1),
          redis.llen('failed_events').catch(() => -1),
          redis.lrange('analytics_queue', 0, limit - 1).catch(() => [] as string[]),
          redis.lrange('failed_events', 0, limit - 1).catch(() => [] as string[]),
        ])

        return {
          status: 'ok',
          limit,
          analytics_queue: {
            depth: queueDepth,
            sample: queueRaw.map(mapQueueItem),
          },
          failed_events: {
            depth: dlqDepth,
            sample: dlqRaw.map(mapFailedItem),
          },
          timestamp: new Date().toISOString(),
        }
      } catch {
        return reply
          .status(503)
          .send({ status: 'error', reason: 'queues_unavailable' })
      }
    },
  )
}
