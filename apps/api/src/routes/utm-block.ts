import type { FastifyInstance, FastifySchema } from 'fastify'
import { getBlockedUtmLists } from '../services/utm-block.service.js'

const utmBlockedSchema = {
  querystring: {
    type: 'object',
    required: ['wid'],
    properties: {
      wid: { type: 'string', format: 'uuid' },
    },
  },
} satisfies FastifySchema

const UTM_BLOCKED_RATE_LIMIT = {
  rateLimit: {
    max: 120,
    timeWindow: '1 minute',
  },
} as const

export async function utmBlockRoutes(server: FastifyInstance) {
  server.get<{ Querystring: { wid: string } }>(
    '/v1/utm-blocked',
    {
      schema: utmBlockedSchema,
      config: UTM_BLOCKED_RATE_LIMIT,
    },
    async (request, reply) => {
      const { wid } = request.query
      const lists = await getBlockedUtmLists(wid)

      reply.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=30')
      return lists
    },
  )
}
