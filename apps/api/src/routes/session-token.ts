import type { FastifyInstance, FastifySchema } from 'fastify'
import { hasBrowserOriginOrReferer } from '../lib/browser-origin.js'
import { issueSessionToken } from '../lib/session-token.js'
import { reconcileLandingPageIngest } from '../services/landing-page-ingest.js'

const sessionTokenSchema = {
  body: {
    type: 'object',
    required: ['wid', 'sid', 'uid'],
    additionalProperties: false,
    properties: {
      wid: { type: 'string', format: 'uuid' },
      sid: { type: 'string', minLength: 8, maxLength: 64 },
      uid: { type: 'string', minLength: 8, maxLength: 64 },
      lp_id: {
        type: 'string',
        maxLength: 160,
        pattern: '^lp_[A-Za-z0-9_-]{8,128}$',
      },
    },
  },
} satisfies FastifySchema

const RATE_LIMIT = {
  rateLimit: {
    max: 300,
    timeWindow: '1 minute',
  },
} as const

export async function sessionTokenRoutes(server: FastifyInstance) {
  server.post<{
    Body: { wid: string; sid: string; uid: string; lp_id?: string }
  }>(
    '/v1/session-token',
    {
      schema: sessionTokenSchema,
      config: RATE_LIMIT,
    },
    async (request, reply) => {
      if (!hasBrowserOriginOrReferer(request.headers)) {
        return reply.code(403).send({
          status: 'forbidden',
          error: 'BROWSER_ORIGIN_REQUIRED',
          trace_id: request.id,
        })
      }

      const originHeader = request.headers.origin
      const refererHeader = request.headers.referer ?? request.headers.referrer
      const landing = await reconcileLandingPageIngest({
        lpIdRaw: request.body.lp_id,
        wid: request.body.wid,
        requestOrigin:
          typeof originHeader === 'string' ? originHeader : undefined,
        requestReferer:
          typeof refererHeader === 'string' ? refererHeader : undefined,
        eventUrl: undefined,
        ev: 'sdk_connected',
        props: undefined,
      })

      if (landing.outcome !== 'ok') {
        return reply.code(400).send({
          status: 'invalid_landing_page_context',
          reason: landing.outcome === 'reject' ? landing.reason : 'UNKNOWN_LANDING_PAGE',
          trace_id: request.id,
        })
      }

      const issued = issueSessionToken({
        wid: request.body.wid,
        lpId: request.body.lp_id,
        sid: request.body.sid,
        uid: request.body.uid,
      })

      if (!issued.ok) {
        return reply.code(503).send({
          status: 'unavailable',
          error: 'SESSION_TOKEN_SECRET_UNAVAILABLE',
          trace_id: request.id,
        })
      }

      return reply.code(200).send({
        status: 'ok',
        token: issued.token,
        expires_at: issued.expiresAt,
        trace_id: request.id,
      })
    },
  )
}
