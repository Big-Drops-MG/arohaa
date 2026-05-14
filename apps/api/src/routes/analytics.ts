import type { FastifyInstance, FastifySchema } from 'fastify'
import { getAnalyticsOverview } from '../services/analytics.service.js'

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
}
