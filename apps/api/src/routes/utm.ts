import type { FastifyInstance } from 'fastify'
import { verifyInternalApiRequest } from '../lib/internal-api-secret.js'
import {
  getBlockedUtmSets,
  invalidateBlockedUtmCache,
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

  server.post<{ Body: { landingPageId?: string } }>(
    '/v1/internal/utm-blocked/invalidate',
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      if (!verifyInternalApiRequest(request.headers['x-arohaa-internal'])) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const landingPageId = request.body?.landingPageId?.trim()
      if (!landingPageId || !UUID_RE.test(landingPageId)) {
        return reply.code(400).send({ error: 'Invalid landingPageId' })
      }

      invalidateBlockedUtmCache(landingPageId)
      return reply.send({ ok: true })
    },
  )
}
