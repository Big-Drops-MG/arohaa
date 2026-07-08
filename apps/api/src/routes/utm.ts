import type { FastifyInstance } from 'fastify'
import {
  getBlockedUtmSets,
  serializeBlockedUtmResponse,
} from '../services/utm-block.service.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const UTM_BLOCKED_RATE_LIMIT = {
  rateLimit: {
    max: 240,
    timeWindow: '1 minute',
  },
} as const

export async function utmRoutes(server: FastifyInstance) {
  server.get<{ Querystring: { wid: string } }>(
    '/v1/utm-blocked',
    {
      config: UTM_BLOCKED_RATE_LIMIT,
      schema: {
        querystring: {
          type: 'object',
          required: ['wid'],
          properties: {
            wid: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { wid } = request.query
      if (!UUID_RE.test(wid)) {
        return reply.code(400).send({ error: 'Invalid wid' })
      }

      const sets = await getBlockedUtmSets(wid)
      return reply.send(serializeBlockedUtmResponse(sets))
    },
  )
}
