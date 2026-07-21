import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { isClickHouseUnavailableError } from '../lib/is-clickhouse-unavailable.js'
import {
  resolveInternalApiSecret,
  verifyInternalApiRequest,
} from '../lib/internal-api-secret.js'
import { verifyWorkspaceApiKeyForWorkspace } from '../lib/workspace-api-key-auth.js'
import {
  emptyAnalyticsFunnel,
  getAnalyticsFunnel,
} from '../services/analytics-funnel.service.js'
import {
  emptyAnalyticsTraffic,
  getAnalyticsTraffic,
} from '../services/analytics-traffic.service.js'
import {
  emptyAnalyticsOverview,
  emptyLandingPageCardMetrics,
  getAnalyticsOverview,
  getLandingPageCardMetrics,
} from '../services/analytics.service.js'
import {
  emptyAnalyticsEvents,
  getAnalyticsEvents,
} from '../services/analytics-events.service.js'
import {
  emptyAnalyticsSegments,
  getAnalyticsSegments,
} from '../services/analytics-segments.service.js'
import {
  emptyAnalyticsExperiments,
  getAnalyticsExperiments,
} from '../services/analytics-experiments.service.js'
import {
  emptyAnalyticsAlerts,
  getAnalyticsAlerts,
} from '../services/analytics-alerts.service.js'
import {
  emptyAnalyticsSeo,
  getAnalyticsSeo,
  syncSeoResults,
} from '../services/analytics-seo.service.js'
import { getDiscoveredUtmParams, getUtmDimensionValues } from '../services/analytics-utm-discover.service.js'
import { parseAnalyticsUtmFilter } from '../lib/analytics-utm-filter.js'
import {
  ANALYTICS_RANGE_IDS,
  DEFAULT_ANALYTICS_RANGE_ID,
  isAnalyticsRangeId,
  parseAnalyticsCustomRange,
  type AnalyticsCustomRange,
  type AnalyticsRangeId,
} from '../lib/analytics-range.js'
import type { SeoSortField } from '../types/analytics-seo.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ANALYTICS_RATE_LIMIT = {
  rateLimit: {
    max: 120,
    timeWindow: '1 minute',
  },
} as const

const utmFilterSchemaProps = {
  utm_source: { type: 'string', minLength: 1, maxLength: 2000 },
  utm_s1: { type: 'string', minLength: 1, maxLength: 2000 },
  utm_dim: { type: 'string', enum: ['utm_source', 'utm_s1', 'utm_medium'] },
  utm_value: { type: 'string', minLength: 1, maxLength: 100 },
} as const

const rangeIdSchema = {
  type: 'string',
  enum: [...ANALYTICS_RANGE_IDS],
  maxLength: 20,
} as const

const customRangeSchemaProps = {
  from: { type: 'string', minLength: 10, maxLength: 10 },
  to: { type: 'string', minLength: 10, maxLength: 10 },
} as const

const workspaceSchema = {
  querystring: {
    type: 'object',
    required: ['workspace_id'],
    properties: {
      workspace_id: { type: 'string', format: 'uuid' },
      ...utmFilterSchemaProps,
    },
  },
} as const

const rangeSchema = {
  querystring: {
    type: 'object',
    required: ['workspace_id'],
    properties: {
      workspace_id: { type: 'string', format: 'uuid' },
      range_id: rangeIdSchema,
      ...customRangeSchemaProps,
      ...utmFilterSchemaProps,
    },
  },
} as const

const funnelSchema = {
  querystring: {
    type: 'object',
    required: ['workspace_id'],
    properties: {
      workspace_id: { type: 'string', format: 'uuid' },
      range_id: rangeIdSchema,
      ...customRangeSchemaProps,
      form_type: {
        type: 'string',
        enum: ['zip', 'single', 'multiple'],
      },
      ...utmFilterSchemaProps,
    },
  },
} as const

type RangeQuery = {
  range_id?: string
  from?: string
  to?: string
}

type ParsedRangeQuery =
  | { ok: true; rangeId: AnalyticsRangeId; custom?: AnalyticsCustomRange }
  | { ok: false; error: string }

function parseRangeQuery(query: RangeQuery): ParsedRangeQuery {
  const rangeId = query.range_id?.trim() || DEFAULT_ANALYTICS_RANGE_ID
  if (!isAnalyticsRangeId(rangeId)) {
    return { ok: false, error: 'Invalid range_id' }
  }
  if (rangeId === 'custom') {
    const custom = parseAnalyticsCustomRange(query.from, query.to)
    if (!custom) {
      return { ok: false, error: 'from and to are required for custom range' }
    }
    return { ok: true, rangeId, custom }
  }
  return { ok: true, rangeId }
}

async function guardAnalyticsRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  workspaceId: string,
): Promise<boolean> {
  if (!UUID_RE.test(workspaceId)) {
    void reply.code(400).send({ error: 'Invalid workspace_id' })
    return false
  }

  if (verifyInternalApiRequest(request.headers['x-arohaa-internal'])) {
    return true
  }

  if (
    await verifyWorkspaceApiKeyForWorkspace(
      request.headers.authorization,
      workspaceId,
    )
  ) {
    return true
  }

  if (!resolveInternalApiSecret()) {
    void reply.code(503).send({ error: 'Analytics not configured on this server' })
    return false
  }

  void reply.code(401).send({ error: 'Unauthorized' })
  return false
}

async function sendAnalyticsQuery<T>({
  request,
  reply,
  workspaceId,
  emptyValue,
  run,
  logLabel,
  logContext,
}: {
  request: FastifyRequest
  reply: FastifyReply
  workspaceId: string
  emptyValue: T
  run: () => Promise<T>
  logLabel: string
  logContext?: Record<string, unknown>
}): Promise<void> {
  if (!(await guardAnalyticsRequest(request, reply, workspaceId))) return

  try {
    const result = await run()
    request.log.info({ workspace_id: workspaceId, ...logContext }, logLabel)
    await reply.send(result)
  } catch (err) {
    if (isClickHouseUnavailableError(err)) {
      request.log.warn(
        { err, workspace_id: workspaceId, ...logContext },
        `${logLabel} fallback to empty analytics payload`,
      )
      await reply.send(emptyValue)
      return
    }

    request.log.error({ err, workspace_id: workspaceId, ...logContext }, `${logLabel} failed`)
    await reply.code(500).send({ error: 'Analytics query failed' })
  }
}

export async function analyticsRoutes(server: FastifyInstance) {
  server.get<{
    Querystring: {
      workspace_id: string
      form_type?: string
      range_id?: string
      from?: string
      to?: string
      utm_source?: string
      utm_s1?: string
      utm_dim?: string
      utm_value?: string
    }
  }>(
    '/v1/analytics/overview',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['workspace_id'],
          properties: {
            workspace_id: { type: 'string', format: 'uuid' },
            form_type: { type: 'string', enum: ['zip', 'single', 'multiple'] },
            range_id: rangeIdSchema,
            ...customRangeSchemaProps,
            ...utmFilterSchemaProps,
          },
        },
      },
      config: ANALYTICS_RATE_LIMIT,
    },
    async (request, reply) => {
      const { workspace_id, form_type } = request.query
      const parsed = parseRangeQuery(request.query)
      if (!parsed.ok) {
        return reply.code(400).send({ error: parsed.error })
      }
      const utmFilter = parseAnalyticsUtmFilter(request.query)
      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        emptyValue: emptyAnalyticsOverview(parsed.rangeId, parsed.custom),
        run: () =>
          getAnalyticsOverview(
            workspace_id,
            form_type,
            utmFilter,
            parsed.rangeId,
            parsed.custom,
          ),
        logLabel: 'analytics overview query ok',
        logContext: { range_id: parsed.rangeId },
      })
    },
  )

  server.get<{
    Querystring: {
      workspace_id: string
      range_id?: string
      from?: string
      to?: string
      utm_source?: string
      utm_s1?: string
      utm_dim?: string
      utm_value?: string
    }
  }>(
    '/v1/analytics/traffic',
    { schema: rangeSchema, config: ANALYTICS_RATE_LIMIT },
    async (request, reply) => {
      const { workspace_id } = request.query
      const parsed = parseRangeQuery(request.query)
      if (!parsed.ok) {
        return reply.code(400).send({ error: parsed.error })
      }
      const utmFilter = parseAnalyticsUtmFilter(request.query)

      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        emptyValue: emptyAnalyticsTraffic(parsed.rangeId),
        run: () =>
          getAnalyticsTraffic({
            workspaceId: workspace_id,
            rangeId: parsed.rangeId,
            utmFilter,
            custom: parsed.custom,
          }),
        logLabel: 'analytics traffic query ok',
        logContext: { range_id: parsed.rangeId },
      })
    },
  )

  server.get<{
    Querystring: {
      workspace_id: string
      range_id?: string
      from?: string
      to?: string
      form_type?: string
      utm_source?: string
      utm_s1?: string
      utm_dim?: string
      utm_value?: string
    }
  }>(
    '/v1/analytics/funnel',
    { schema: funnelSchema, config: ANALYTICS_RATE_LIMIT },
    async (request, reply) => {
      const { workspace_id, form_type } = request.query
      const parsed = parseRangeQuery(request.query)
      if (!parsed.ok) {
        return reply.code(400).send({ error: parsed.error })
      }
      const utmFilter = parseAnalyticsUtmFilter(request.query)

      const formType =
        form_type === 'zip' || form_type === 'single' || form_type === 'multiple'
          ? form_type
          : 'single'

      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        emptyValue: emptyAnalyticsFunnel(parsed.rangeId),
        run: () =>
          getAnalyticsFunnel({
            workspaceId: workspace_id,
            rangeId: parsed.rangeId,
            formType,
            utmFilter,
            custom: parsed.custom,
          }),
        logLabel: 'analytics funnel query ok',
        logContext: { range_id: parsed.rangeId, form_type: formType },
      })
    },
  )

  server.get<{
    Querystring: {
      workspace_id: string
      range_id?: string
      from?: string
      to?: string
      utm_source?: string
      utm_s1?: string
      utm_dim?: string
      utm_value?: string
    }
  }>(
    '/v1/analytics/events',
    { schema: rangeSchema, config: ANALYTICS_RATE_LIMIT },
    async (request, reply) => {
      const { workspace_id } = request.query
      const parsed = parseRangeQuery(request.query)
      if (!parsed.ok) {
        return reply.code(400).send({ error: parsed.error })
      }
      const utmFilter = parseAnalyticsUtmFilter(request.query)

      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        emptyValue: emptyAnalyticsEvents(),
        run: () =>
          getAnalyticsEvents({
            workspaceId: workspace_id,
            rangeId: parsed.rangeId,
            utmFilter,
            custom: parsed.custom,
          }),
        logLabel: 'analytics events query ok',
        logContext: { range_id: parsed.rangeId },
      })
    },
  )

  server.get<{
    Querystring: {
      workspace_id: string
      range_id?: string
      from?: string
      to?: string
      utm_source?: string
      utm_s1?: string
      utm_dim?: string
      utm_value?: string
    }
  }>(
    '/v1/analytics/segments',
    { schema: rangeSchema, config: ANALYTICS_RATE_LIMIT },
    async (request, reply) => {
      const { workspace_id } = request.query
      const parsed = parseRangeQuery(request.query)
      if (!parsed.ok) {
        return reply.code(400).send({ error: parsed.error })
      }
      const utmFilter = parseAnalyticsUtmFilter(request.query)

      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        emptyValue: emptyAnalyticsSegments(),
        run: () =>
          getAnalyticsSegments({
            workspaceId: workspace_id,
            rangeId: parsed.rangeId,
            utmFilter,
            custom: parsed.custom,
          }),
        logLabel: 'analytics segments query ok',
        logContext: { range_id: parsed.rangeId },
      })
    },
  )

  server.get<{
    Querystring: {
      workspace_id: string
      lp_public_id: string
      range_id?: string
      from?: string
      to?: string
      utm_source?: string
      utm_s1?: string
      utm_dim?: string
      utm_value?: string
    }
  }>(
    '/v1/analytics/experiments',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['workspace_id', 'lp_public_id'],
          properties: {
            workspace_id: { type: 'string', format: 'uuid' },
            lp_public_id: { type: 'string', minLength: 1 },
            range_id: rangeIdSchema,
            ...customRangeSchemaProps,
            ...utmFilterSchemaProps,
          },
        },
      },
      config: ANALYTICS_RATE_LIMIT,
    },
    async (request, reply) => {
      const { workspace_id, lp_public_id } = request.query
      const parsed = parseRangeQuery(request.query)
      if (!parsed.ok) {
        return reply.code(400).send({ error: parsed.error })
      }
      const utmFilter = parseAnalyticsUtmFilter(request.query)

      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        emptyValue: emptyAnalyticsExperiments(),
        run: () =>
          getAnalyticsExperiments({
            workspaceId: workspace_id,
            lpPublicId: lp_public_id,
            rangeId: parsed.rangeId,
            utmFilter,
            custom: parsed.custom,
          }),
        logLabel: 'analytics experiments query ok',
        logContext: { range_id: parsed.rangeId, lp_public_id },
      })
    },
  )

  server.get<{ Querystring: { workspace_id: string } }>(
    '/v1/analytics/landing-summary',
    { schema: workspaceSchema, config: ANALYTICS_RATE_LIMIT },
    async (request, reply) => {
      const { workspace_id } = request.query
      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        emptyValue: emptyLandingPageCardMetrics(),
        run: () => getLandingPageCardMetrics(workspace_id),
        logLabel: 'landing summary query ok',
      })
    },
  )

  server.get<{ Querystring: { workspace_id: string } }>(
    '/v1/analytics/utm-discovered',
    { schema: workspaceSchema, config: ANALYTICS_RATE_LIMIT },
    async (request, reply) => {
      const { workspace_id } = request.query
      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        emptyValue: [] as Array<{ key: string; value: string }>,
        run: () => getDiscoveredUtmParams(workspace_id),
        logLabel: 'utm discovered query ok',
      })
    },
  )

  server.get<{ Querystring: { workspace_id: string; dim: string } }>(
    '/v1/analytics/utm-values',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['workspace_id', 'dim'],
          properties: {
            workspace_id: { type: 'string', format: 'uuid' },
            dim: { type: 'string', enum: ['utm_source', 'utm_s1'] },
          },
        },
      },
      config: ANALYTICS_RATE_LIMIT,
    },
    async (request, reply) => {
      const { workspace_id, dim } = request.query
      if (dim !== 'utm_source' && dim !== 'utm_s1') {
        return reply.code(400).send({ error: 'Invalid dim' })
      }
      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        emptyValue: [] as string[],
        run: () => getUtmDimensionValues(workspace_id, dim),
        logLabel: 'utm values query ok',
        logContext: { dim },
      })
    },
  )

  server.get<{
    Querystring: {
      workspace_id: string
      lp_public_id: string
      range_id?: string
      from?: string
      to?: string
      utm_source?: string
      utm_s1?: string
      utm_dim?: string
      utm_value?: string
    }
  }>(
    '/v1/analytics/alerts',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['workspace_id', 'lp_public_id'],
          properties: {
            workspace_id: { type: 'string', format: 'uuid' },
            lp_public_id: { type: 'string', minLength: 1 },
            range_id: rangeIdSchema,
            ...customRangeSchemaProps,
            ...utmFilterSchemaProps,
          },
        },
      },
      config: ANALYTICS_RATE_LIMIT,
    },
    async (request, reply) => {
      const { workspace_id, lp_public_id } = request.query
      const parsed = parseRangeQuery(request.query)
      if (!parsed.ok) {
        return reply.code(400).send({ error: parsed.error })
      }
      const utmFilter = parseAnalyticsUtmFilter(request.query)

      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        emptyValue: emptyAnalyticsAlerts(),
        run: () =>
          getAnalyticsAlerts({
            workspaceId: workspace_id,
            lpPublicId: lp_public_id,
            rangeId: parsed.rangeId,
            utmFilter,
            custom: parsed.custom,
          }),
        logLabel: 'analytics alerts query ok',
        logContext: { range_id: parsed.rangeId, lp_public_id },
      })
    },
  )

  const SEO_SORT_FIELDS = new Set<SeoSortField>([
    'clicks',
    'impressions',
    'ctr',
    'position',
    'query',
  ])

  server.get<{
    Querystring: {
      workspace_id: string
      lp_public_id: string
      range_id?: string
      from?: string
      to?: string
      sort_by?: string
      sort_order?: string
    }
  }>(
    '/v1/analytics/seo',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['workspace_id', 'lp_public_id'],
          properties: {
            workspace_id: { type: 'string', format: 'uuid' },
            lp_public_id: { type: 'string', minLength: 1 },
            range_id: rangeIdSchema,
            ...customRangeSchemaProps,
            sort_by: { type: 'string', maxLength: 20 },
            sort_order: { type: 'string', enum: ['asc', 'desc'] },
          },
        },
      },
      config: ANALYTICS_RATE_LIMIT,
    },
    async (request, reply) => {
      const { workspace_id, lp_public_id, sort_by, sort_order } = request.query
      const parsed = parseRangeQuery(request.query)
      if (!parsed.ok) {
        return reply.code(400).send({ error: parsed.error })
      }

      const sortBy = SEO_SORT_FIELDS.has(sort_by as SeoSortField)
        ? (sort_by as SeoSortField)
        : 'clicks'
      const sortOrder = sort_order === 'asc' ? 'asc' : 'desc'

      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        emptyValue: emptyAnalyticsSeo(parsed.rangeId, sortBy, sortOrder),
        run: () =>
          getAnalyticsSeo({
            workspaceId: workspace_id,
            lpPublicId: lp_public_id,
            rangeId: parsed.rangeId,
            sortBy,
            sortOrder,
            custom: parsed.custom,
          }),
        logLabel: 'analytics seo query ok',
        logContext: { range_id: parsed.rangeId, lp_public_id, sort_by: sortBy },
      })
    },
  )

  server.post<{
    Body: {
      workspace_id: string
      lp_public_id: string
      rows: Array<{
        query: string
        pageUrl: string
        clicks: number
        impressions: number
        ctr: number
        position: number
        reportDate: string
      }>
    }
  }>(
    '/v1/analytics/seo/sync',
    {
      schema: {
        body: {
          type: 'object',
          required: ['workspace_id', 'lp_public_id', 'rows'],
          properties: {
            workspace_id: { type: 'string', format: 'uuid' },
            lp_public_id: { type: 'string', minLength: 1 },
            rows: {
              type: 'array',
              maxItems: 5000,
              items: {
                type: 'object',
                required: [
                  'query',
                  'pageUrl',
                  'clicks',
                  'impressions',
                  'ctr',
                  'position',
                  'reportDate',
                ],
                properties: {
                  query: { type: 'string', minLength: 1, maxLength: 500 },
                  pageUrl: { type: 'string', minLength: 1, maxLength: 2048 },
                  clicks: { type: 'number', minimum: 0 },
                  impressions: { type: 'number', minimum: 0 },
                  ctr: { type: 'number', minimum: 0 },
                  position: { type: 'number', minimum: 0 },
                  reportDate: { type: 'string', minLength: 8, maxLength: 32 },
                },
              },
            },
          },
        },
      },
      config: ANALYTICS_RATE_LIMIT,
    },
    async (request, reply) => {
      const { workspace_id, lp_public_id, rows } = request.body

      if (!resolveInternalApiSecret()) {
        return reply.code(503).send({ error: 'Analytics not configured on this server' })
      }

      if (!verifyInternalApiRequest(request.headers['x-arohaa-internal'])) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      if (!UUID_RE.test(workspace_id)) {
        return reply.code(400).send({ error: 'Invalid workspace_id' })
      }

      try {
        const result = await syncSeoResults({
          workspaceId: workspace_id,
          lpPublicId: lp_public_id,
          rows,
        })
        return reply.send(result)
      } catch (err) {
        request.log.error({ err, workspace_id, lp_public_id }, 'seo sync failed')
        return reply.code(400).send({ error: 'SEO sync failed' })
      }
    },
  )
}
