import type { FastifyInstance } from 'fastify'
import { pingClickHouse } from '../services/clickhouse.service.js'

const PING_TIMEOUT_MS = 3000
const HEALTH_RATE_LIMIT_OPT_OUT = { rateLimit: false } as const

export async function healthRoutes(server: FastifyInstance) {
  server.get(
    '/health',
    { config: HEALTH_RATE_LIMIT_OPT_OUT },
    async (request, reply) => {
      const start = Date.now()
      const isClickHouseUp = await pingClickHouse(PING_TIMEOUT_MS)
      const latencyMs = Date.now() - start

      if (!isClickHouseUp) {
        return reply.status(503).send({
          status: 'error',
          service: 'arohaa-ingestion-api',
          dependencies: { clickhouse: 'unreachable' },
          latency_ms: latencyMs,
          trace_id: request.id,
        })
      }

      return {
        status: 'ok',
        service: 'arohaa-ingestion-api',
        dependencies: { clickhouse: 'ok' },
        latency_ms: latencyMs,
        timestamp: new Date().toISOString(),
        trace_id: request.id,
      }
    },
  )
}
