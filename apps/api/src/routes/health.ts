import type { FastifyInstance } from 'fastify'
import { CLICKHOUSE_EVENTS_TABLE } from '../lib/clickhouse-events-table.js'
import {
  getClickHouseClient,
  pingClickHouse,
  shouldSkipClickHouse,
} from '../services/clickhouse.service.js'
import { redis } from '../services/redis.service.js'
import { sendAlertWebhook } from '../lib/alert-webhook.js'
import { db, sql } from '@workspace/database'

const PING_TIMEOUT_MS = 3000
const HEALTH_RATE_LIMIT_OPT_OUT = { rateLimit: false } as const

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
}
