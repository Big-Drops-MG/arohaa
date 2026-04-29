import type { FastifyInstance, FastifySchema } from 'fastify'
import { pushEvent } from '../services/event-buffer.js'
import { ingestBodyToEventRow, type IngestEventBody } from '../types/event.js'
import { buildEnrichmentContext } from '../utils/enrichment.js'
import { normalizeReferrer } from '../utils/referrer.js'

const ingestSchema = {
  body: {
    type: 'object',
    required: ['ev', 'wid', 'sid', 'uid'],
    additionalProperties: false,
    properties: {
      ev: {
        type: 'string',
        maxLength: 50,
        pattern: '^[a-z0-9_]+$',
      },
      wid: { type: 'string', format: 'uuid' },
      sid: { type: 'string', minLength: 8, maxLength: 64 },
      uid: { type: 'string', minLength: 8, maxLength: 64 },
      fp: { type: 'string', pattern: '^[a-f0-9]{1,16}$' },
      ts: { type: 'number' },
      url: { type: 'string', format: 'uri-reference', maxLength: 2048 },
      page: { type: 'string', maxLength: 256 },
      variant: { type: 'string', maxLength: 32 },
      formtype: { type: 'string', enum: ['zip', 'single', 'multiple'] },
      utm_source: { type: 'string', maxLength: 100 },
      utm_medium: { type: 'string', maxLength: 100 },
      utm_campaign: { type: 'string', maxLength: 255 },
      utm_term: { type: 'string', maxLength: 500 },
      utm_content: { type: 'string', maxLength: 255 },
      referrer: { type: 'string', maxLength: 2048 },
      metric_name: { type: 'string', maxLength: 50 },
      metric_value: { type: 'number' },
      props: {
        type: 'object',
        additionalProperties: true,
        maxProperties: 15,
      },
    },
  },
} satisfies FastifySchema

const INGEST_RATE_LIMIT = {
  rateLimit: {
    max: 600,
    timeWindow: '1 minute',
  },
} as const

export async function ingestRoutes(server: FastifyInstance) {
  server.post<{ Body: IngestEventBody }>(
    '/v1/ingest',
    {
      schema: ingestSchema,
      config: INGEST_RATE_LIMIT,
    },
    async (request, reply) => {
      const ctx = buildEnrichmentContext(request)
      const referrerSource = normalizeReferrer(request.body.referrer)

      const row = ingestBodyToEventRow(request.body, request.id, {
        referrerSource,
        browser: ctx.ua.browser,
        os: ctx.ua.os,
        device: ctx.ua.device,
        country: ctx.geo.country,
        city: ctx.geo.city,
      })

      pushEvent(row)
      return reply.code(202).send({ status: 'accepted', trace_id: request.id })
    },
  )
}
