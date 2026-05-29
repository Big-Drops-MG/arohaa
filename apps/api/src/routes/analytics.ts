import type { FastifyInstance, FastifySchema } from 'fastify'
import { getAnalyticsTraffic } from '../services/analytics-traffic.service.js'
import {
  getAnalyticsOverview,
  getLandingPageCardMetrics,
} from '../services/analytics.service.js'
import { isTrafficRangeId } from '../types/analytics-traffic.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const schema = {
  querystring: {
    type: 'object',
    required: ['workspace_id'],
    properties: {
      workspace_id: { type: 'string', format: 'uuid' },
    },
  },
} satisfies FastifySchema

const trafficSchema = {
  querystring: {
    type: 'object',
    required: ['workspace_id'],
    properties: {
      workspace_id: { type: 'string', format: 'uuid' },
      range_id: {
        type: 'string',
        enum: ['24h', '7d', '30d', '3m', '12m', '24m'],
      },
    },
  },
} satisfies FastifySchema

const DEFAULT_TRAFFIC_RANGE_ID = '7d' as const

export async function analyticsRoutes(server: FastifyInstance) {
  server.get<{ Querystring: { workspace_id: string } }>(
    '/v1/analytics/overview',
    { schema },
    async (request, reply) => {
      const secret = process.env.AROHAA_INTERNAL_API_SECRET?.trim()
      if (!secret) {
        return reply.code(503).send({ error: 'Analytics not configured on this server' })
      }

      const incoming = request.headers['x-arohaa-internal']
      if (incoming !== secret) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const { workspace_id } = request.query
      if (!UUID_RE.test(workspace_id)) {
        return reply.code(400).send({ error: 'Invalid workspace_id' })
      }

      try {
        const overview = await getAnalyticsOverview(workspace_id)
        return reply.send(overview)
      } catch (err) {
        request.log.error({ err, workspace_id }, 'analytics overview query failed')
        return reply.code(500).send({ error: 'Analytics query failed' })
      }
    },
  )

  server.get<{ Querystring: { workspace_id: string; range_id?: string } }>(
    '/v1/analytics/traffic',
    { schema: trafficSchema },
    async (request, reply) => {
      const secret = process.env.AROHAA_INTERNAL_API_SECRET?.trim()
      if (!secret) {
        return reply.code(503).send({ error: 'Analytics not configured on this server' })
      }

      const incoming = request.headers['x-arohaa-internal']
      if (incoming !== secret) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const { workspace_id, range_id } = request.query
      if (!UUID_RE.test(workspace_id)) {
        return reply.code(400).send({ error: 'Invalid workspace_id' })
      }

      const rangeId = range_id?.trim() || DEFAULT_TRAFFIC_RANGE_ID
      if (!isTrafficRangeId(rangeId)) {
        return reply.code(400).send({ error: 'Invalid range_id' })
      }

      try {
        const traffic = await getAnalyticsTraffic({ workspaceId: workspace_id, rangeId })
        request.log.info({ workspace_id, range_id: rangeId }, 'analytics traffic query ok')
        return reply.send(traffic)
      } catch (err) {
        request.log.error({ err, workspace_id, range_id: rangeId }, 'analytics traffic query failed')
        return reply.code(500).send({ error: 'Analytics query failed' })
      }
    },
  )

  server.get<{ Querystring: { workspace_id: string } }>(
    '/v1/analytics/landing-summary',
    { schema },
    async (request, reply) => {
      const secret = process.env.AROHAA_INTERNAL_API_SECRET?.trim()
      if (!secret) {
        return reply.code(503).send({ error: 'Analytics not configured on this server' })
      }

      const incoming = request.headers['x-arohaa-internal']
      if (incoming !== secret) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const { workspace_id } = request.query
      if (!UUID_RE.test(workspace_id)) {
        return reply.code(400).send({ error: 'Invalid workspace_id' })
      }

      try {
        const summary = await getLandingPageCardMetrics(workspace_id)
        return reply.send(summary)
      } catch (err) {
        request.log.error({ err, workspace_id }, 'landing summary query failed')
        return reply.code(500).send({ error: 'Analytics query failed' })
      }
    },
  )
}
