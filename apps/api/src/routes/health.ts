import type { FastifyInstance } from 'fastify'
import { pingClickHouse } from '../services/clickhouse.service.js'
import { redis } from '../services/redis.service.js'
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
      const start = Date.now()

      const timeoutPromise = new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), PING_TIMEOUT_MS),
      )

      const [isClickHouseUp, isRedisUp, isPostgresUp] = await Promise.all([
        pingClickHouse(PING_TIMEOUT_MS),
        Promise.race([
          redis.ping().then(() => true).catch(() => false),
          timeoutPromise,
        ]),
        Promise.race([
          db.execute(sql`SELECT 1 AS ok`).then(() => true).catch(() => false),
          timeoutPromise,
        ]),
      ])

      const latencyMs = Date.now() - start

      if (!isClickHouseUp || !isRedisUp || !isPostgresUp) {
        return reply.status(503).send({
          status: 'error',
          service: 'arohaa-ingestion-api',
          dependencies: {
            clickhouse: isClickHouseUp ? 'ok' : 'unreachable',
            redis: isRedisUp ? 'ok' : 'unreachable',
            postgres: isPostgresUp ? 'ok' : 'unreachable',
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
        latency_ms: latencyMs,
        timestamp: new Date().toISOString(),
        trace_id: request.id,
      }
    },
  )
}
