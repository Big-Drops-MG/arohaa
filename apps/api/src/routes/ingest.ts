import type { FastifyInstance, FastifyRequest, FastifySchema } from 'fastify'
import {
  isHeatmapEvent,
  validateHeatmapProps,
} from '../schemas/heatmap-events.js'
import { pushEvent } from '../services/event-buffer.js'
import { reconcileLandingPageIngest } from '../services/landing-page-ingest.js'
import {
  getBlockedUtmSets,
  isUtmBlocked,
} from '../services/utm-block.service.js'
import { ingestBodyToEventRow, type IngestEventBody } from '../types/event.js'
import { buildEnrichmentContext } from '../utils/enrichment.js'
import { normalizeReferrer } from '../utils/referrer.js'

const eventBodyProperties = {
  ev: {
    type: 'string',
    maxLength: 50,
    pattern: '^[a-z0-9_]+$',
  },
  event_name: {
    type: 'string',
    maxLength: 50,
    pattern: '^[a-z0-9_]+$',
  },
  wid: { type: 'string', format: 'uuid' },
  workspace_id: { type: 'string', format: 'uuid' },
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
  utm_id: { type: 'string', maxLength: 100 },
  utm_s1: { type: 'string', maxLength: 100 },
  referrer: { type: 'string', maxLength: 2048 },
  metric_name: { type: 'string', maxLength: 50 },
  metric_value: { type: 'number' },
  lp_id: {
    type: 'string',
    maxLength: 160,
    pattern: '^lp_[A-Za-z0-9_-]{8,128}$',
  },
  props: {
    type: 'object',
    additionalProperties: true,
    maxProperties: 15,
  },
} as const

const ingestSchema = {
  body: {
    type: 'object',
    required: ['sid', 'uid'],
    anyOf: [
      { required: ['ev', 'wid'] },
      { required: ['event_name', 'workspace_id'] },
    ],
    additionalProperties: false,
    properties: eventBodyProperties,
  },
} satisfies FastifySchema

const batchIngestSchema = {
  body: {
    type: 'object',
    required: ['events'],
    additionalProperties: false,
    properties: {
      events: {
        type: 'array',
        minItems: 1,
        maxItems: 50,
        items: {
          type: 'object',
          required: ['sid', 'uid'],
          anyOf: [
            { required: ['ev', 'wid'] },
            { required: ['event_name', 'workspace_id'] },
          ],
          additionalProperties: false,
          properties: eventBodyProperties,
        },
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

const BATCH_INGEST_RATE_LIMIT = {
  rateLimit: {
    max: 120,
    timeWindow: '1 minute',
  },
} as const

type IngestOneResult =
  | { status: 'accepted' }
  | { status: 'rejected'; error: string; code: number }
  | { status: 'dropped' }

async function ingestOne(
  body: IngestEventBody,
  request: FastifyRequest,
  traceId: string,
): Promise<IngestOneResult> {
  const ev = body.event_name ?? body.ev ?? ''

  if (isHeatmapEvent(ev)) {
    const heatmapError = validateHeatmapProps(ev, body.props)
    if (heatmapError) {
      return { status: 'rejected', error: heatmapError, code: 400 }
    }
  }

  const landing = await reconcileLandingPageIngest({
    lpIdRaw: body.lp_id,
    wid: body.workspace_id ?? body.wid ?? '',
    eventUrl: body.url,
    ev,
    props: body.props,
  })

  if (landing.outcome === 'reject') {
    request.log.warn(
      {
        trace_id: traceId,
        event: 'ingest_lp_rejected',
        reason: landing.reason,
        lp_id: body.lp_id,
        wid: body.workspace_id ?? body.wid,
      },
      'ingest landing-page validation failed',
    )
    return {
      status: 'rejected',
      error: landing.reason,
      code: 400,
    }
  }

  if (landing.outcome === 'ok') {
    request.log.info({
      trace_id: traceId,
      event: 'ingest_lp_linked',
      lp_id: body.lp_id,
      wid: body.workspace_id ?? body.wid,
    })
  }

  const landingPageId = body.workspace_id ?? body.wid ?? ''
  if (landingPageId) {
    const blockedSets = await getBlockedUtmSets(landingPageId)
    if (isUtmBlocked(blockedSets, body.utm_source, body.utm_s1)) {
      request.log.info(
        {
          trace_id: traceId,
          event: 'ingest_utm_blocked',
          wid: landingPageId,
          utm_source: body.utm_source,
          utm_s1: body.utm_s1,
        },
        'ingest event dropped by UTM block rule',
      )
      return { status: 'dropped' }
    }
  }

  const ctx = buildEnrichmentContext(request)
  const referrerSource = normalizeReferrer(body.referrer)

  const row = ingestBodyToEventRow(body, traceId, {
    referrerSource,
    browser: ctx.ua.browser,
    os: ctx.ua.os,
    device: ctx.ua.device,
    country: ctx.geo.country,
    city: ctx.geo.city,
    state: ctx.geo.state,
    zipcode: ctx.geo.zipcode,
  })

  pushEvent(row)
  return { status: 'accepted' }
}

export async function ingestRoutes(server: FastifyInstance) {
  server.post<{ Body: IngestEventBody }>(
    '/v1/ingest',
    {
      schema: ingestSchema,
      config: INGEST_RATE_LIMIT,
    },
    async (request, reply) => {
      const result = await ingestOne(request.body, request, request.id)

      if (result.status === 'rejected') {
        const ev = request.body.event_name ?? request.body.ev ?? ''
        if (isHeatmapEvent(ev) && result.error.startsWith('props.')) {
          return reply.code(400).send({
            status: 'invalid_heatmap_props',
            trace_id: request.id,
            error: result.error,
          })
        }
        return reply.code(400).send({
          status: 'invalid_landing_page_context',
          trace_id: request.id,
          reason: result.error,
        })
      }

      return reply.code(202).send({ status: 'accepted', trace_id: request.id })
    },
  )

  server.post<{ Body: { events: IngestEventBody[] } }>(
    '/v1/ingest/batch',
    {
      schema: batchIngestSchema,
      config: BATCH_INGEST_RATE_LIMIT,
    },
    async (request, reply) => {
      const events = request.body.events
      let accepted = 0
      const rejected: Array<{ index: number; error: string }> = []

      for (let i = 0; i < events.length; i++) {
        const body = events[i]!
        const traceId = `${request.id}:${i}`
        const result = await ingestOne(body, request, traceId)

        if (result.status === 'accepted' || result.status === 'dropped') {
          accepted += 1
          continue
        }

        rejected.push({ index: i, error: result.error })
      }

      return reply.code(202).send({
        status: 'accepted',
        trace_id: request.id,
        accepted,
        rejected,
      })
    },
  )
}
