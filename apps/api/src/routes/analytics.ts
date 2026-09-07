import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { isClickHouseUnavailableError } from '../lib/is-clickhouse-unavailable.js'
import {
  resolveInternalApiSecret,
  verifyInternalApiRequest,
} from '../lib/internal-api-secret.js'
import { verifyWorkspaceApiKeyForWorkspace } from '../lib/workspace-api-key-auth.js'
import { guardFunnelLeadsRequest } from '../lib/funnel-leads-auth.js'
import {
  emptyAnalyticsFunnel,
  getAnalyticsFunnel,
} from '../services/analytics-funnel.service.js'
import {
  emptyFunnelLeads,
  getFunnelLeads,
} from '../services/analytics-funnel-leads.service.js'
import { landingPageHasRedirect } from '../lib/landing-redirect.js'
import {
  emptyAnalyticsTraffic,
  getAnalyticsTraffic,
} from '../services/analytics-traffic.service.js'
import {
  emptyAnalyticsOverview,
  emptyLandingPageCardMetrics,
  getAnalyticsOverview,
  getAnalyticsOverviewCities,
  getAnalyticsOverviewZipcodes,
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
import {
  emptyAnalyticsWebVitals,
  getAnalyticsWebVitals,
} from '../services/analytics-web-vitals.service.js'
import {
  emptyAnalyticsInsights,
  getAnalyticsInsights,
} from '../services/analytics-insights.service.js'
import { isInsightSectionId } from '../types/analytics-insights.js'
import { getDiscoveredUtmParams, getUtmDimensionValues } from '../services/analytics-utm-discover.service.js'
import {
  emptyAnalyticsHeatmap,
  getAnalyticsHeatmap,
} from '../services/analytics-heatmap.service.js'
import {
  getCohortRetention,
  type CohortSplitBy,
} from '../services/analytics-retention.service.js'
import type {
  HeatmapDevice,
  HeatmapMode,
} from '../types/analytics-heatmap.js'
import { parseAnalyticsUtmFilter } from '../lib/analytics-utm-filter.js'
import { getSegmentById } from '@workspace/database'
import {
  SegmentCompiler,
  type SegmentGroup,
} from '../services/segment-compiler.service.js'
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
            segment_id: { type: 'string', format: 'uuid' },
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
            segment_id: { type: 'string', format: 'uuid' },
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
        enum: ['zip', 'single', 'multiple', 'none'],
      },
      ...utmFilterSchemaProps,
            segment_id: { type: 'string', format: 'uuid' },
    },
  },
} as const

const heatmapSchema = {
  querystring: {
    type: 'object',
    required: ['workspace_id'],
    properties: {
      workspace_id: { type: 'string', format: 'uuid' },
      range_id: rangeIdSchema,
      ...customRangeSchemaProps,
      mode: {
        type: 'string',
        enum: ['click', 'scroll', 'attention', 'form'],
      },
      device: {
        type: 'string',
        enum: ['all', 'mobile', 'tablet', 'desktop'],
      },
      page_url: { type: 'string', maxLength: 4000 },
    },
  },
} as const

function parseHeatmapMode(value: string | undefined): HeatmapMode {
  if (
    value === 'scroll' ||
    value === 'attention' ||
    value === 'click' ||
    value === 'form'
  ) {
    return value
  }
  return 'click'
}

function parseHeatmapDevice(value: string | undefined): HeatmapDevice {
  if (
    value === 'mobile' ||
    value === 'tablet' ||
    value === 'desktop' ||
    value === 'all'
  ) {
    return value
  }
  return 'all'
}

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
  guard = guardAnalyticsRequest,
}: {
  request: FastifyRequest
  reply: FastifyReply
  workspaceId: string
  emptyValue: T
  run: () => Promise<T>
  logLabel: string
  logContext?: Record<string, unknown>
  guard?: (
    request: FastifyRequest,
    reply: FastifyReply,
    workspaceId: string,
  ) => Promise<boolean>
}): Promise<void> {
  if (!(await guard(request, reply, workspaceId))) return

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



async function resolveSegmentFilter(segmentId?: string, landingPageId?: string) {
  if (!segmentId || !landingPageId) return undefined;
  const segment = await getSegmentById(segmentId);
  if (!segment || segment.landingPageId !== landingPageId || !segment.conditions) {
    return undefined;
  }
  return new SegmentCompiler().compile(segment.conditions as SegmentGroup);
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
      segment_id?: string
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
            form_type: { type: 'string', enum: ['zip', 'single', 'multiple', 'none'] },
            range_id: rangeIdSchema,
            ...customRangeSchemaProps,
            ...utmFilterSchemaProps,
            segment_id: { type: 'string', format: 'uuid' },
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
      const parsedUtm = parseAnalyticsUtmFilter(request.query)
      const segmentFilter = await resolveSegmentFilter(request.query.segment_id, request.query.workspace_id)
      const utmFilter = parsedUtm || {}
      if (segmentFilter) {
        utmFilter.segmentSql = segmentFilter.sql
        utmFilter.segmentParams = segmentFilter.params
      }
      const formType =
        form_type === 'zip' ||
        form_type === 'single' ||
        form_type === 'multiple' ||
        form_type === 'none'
          ? form_type
          : 'single'
      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        emptyValue: emptyAnalyticsOverview(
          parsed.rangeId,
          parsed.custom,
          formType,
        ),
        run: () =>
          getAnalyticsOverview(
            workspace_id,
            formType,
            utmFilter,
            parsed.rangeId,
            parsed.custom,
          ),
        logLabel: 'analytics overview query ok',
        logContext: { range_id: parsed.rangeId, form_type: formType },
      })
    },
  )

  server.get<{
    Querystring: {
      workspace_id: string
      state: string
      form_type?: string
      range_id?: string
      from?: string
      to?: string
      utm_source?: string
      utm_s1?: string
      utm_dim?: string
      utm_value?: string
      segment_id?: string
    }
  }>(
    '/v1/analytics/overview/cities',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['workspace_id', 'state'],
          properties: {
            workspace_id: { type: 'string', format: 'uuid' },
            state: { type: 'string', minLength: 1, maxLength: 80 },
            form_type: { type: 'string', enum: ['zip', 'single', 'multiple', 'none'] },
            range_id: rangeIdSchema,
            ...customRangeSchemaProps,
            ...utmFilterSchemaProps,
            segment_id: { type: 'string', format: 'uuid' },
          },
        },
      },
      config: ANALYTICS_RATE_LIMIT,
    },
    async (request, reply) => {
      const { workspace_id, form_type, state } = request.query
      const parsed = parseRangeQuery(request.query)
      if (!parsed.ok) {
        return reply.code(400).send({ error: parsed.error })
      }
      const parsedUtm = parseAnalyticsUtmFilter(request.query)
      const segmentFilter = await resolveSegmentFilter(request.query.segment_id, request.query.workspace_id)
      const utmFilter = parsedUtm || {}
      if (segmentFilter) {
        utmFilter.segmentSql = segmentFilter.sql
        utmFilter.segmentParams = segmentFilter.params
      }
      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        emptyValue: { state: state.trim(), cities: [] },
        run: () =>
          getAnalyticsOverviewCities({
            workspaceId: workspace_id,
            state,
            formTypeRaw: form_type,
            utmFilter,
            rangeId: parsed.rangeId,
            custom: parsed.custom,
          }),
        logLabel: 'analytics overview cities query ok',
        logContext: { range_id: parsed.rangeId, state },
      })
    },
  )

  server.get<{
    Querystring: {
      workspace_id: string
      state: string
      city: string
      form_type?: string
      range_id?: string
      from?: string
      to?: string
      utm_source?: string
      utm_s1?: string
      utm_dim?: string
      utm_value?: string
      segment_id?: string
    }
  }>(
    '/v1/analytics/overview/zipcodes',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['workspace_id', 'state', 'city'],
          properties: {
            workspace_id: { type: 'string', format: 'uuid' },
            state: { type: 'string', minLength: 1, maxLength: 80 },
            city: { type: 'string', minLength: 1, maxLength: 120 },
            form_type: { type: 'string', enum: ['zip', 'single', 'multiple', 'none'] },
            range_id: rangeIdSchema,
            ...customRangeSchemaProps,
            ...utmFilterSchemaProps,
            segment_id: { type: 'string', format: 'uuid' },
          },
        },
      },
      config: ANALYTICS_RATE_LIMIT,
    },
    async (request, reply) => {
      const { workspace_id, form_type, state, city } = request.query
      const parsed = parseRangeQuery(request.query)
      if (!parsed.ok) {
        return reply.code(400).send({ error: parsed.error })
      }
      const parsedUtm = parseAnalyticsUtmFilter(request.query)
      const segmentFilter = await resolveSegmentFilter(request.query.segment_id, request.query.workspace_id)
      const utmFilter = parsedUtm || {}
      if (segmentFilter) {
        utmFilter.segmentSql = segmentFilter.sql
        utmFilter.segmentParams = segmentFilter.params
      }
      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        emptyValue: { state: state.trim(), city: city.trim(), zipcodes: [] },
        run: () =>
          getAnalyticsOverviewZipcodes({
            workspaceId: workspace_id,
            state,
            city,
            formTypeRaw: form_type,
            utmFilter,
            rangeId: parsed.rangeId,
            custom: parsed.custom,
          }),
        logLabel: 'analytics overview zipcodes query ok',
        logContext: { range_id: parsed.rangeId, state, city },
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
      segment_id?: string
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
      const parsedUtm = parseAnalyticsUtmFilter(request.query)
      const segmentFilter = await resolveSegmentFilter(request.query.segment_id, request.query.workspace_id)
      const utmFilter = parsedUtm || {}
      if (segmentFilter) {
        utmFilter.segmentSql = segmentFilter.sql
        utmFilter.segmentParams = segmentFilter.params
      }

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
      segment_id?: string
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
      const parsedUtm = parseAnalyticsUtmFilter(request.query)
      const segmentFilter = await resolveSegmentFilter(request.query.segment_id, request.query.workspace_id)
      const utmFilter = parsedUtm || {}
      if (segmentFilter) {
        utmFilter.segmentSql = segmentFilter.sql
        utmFilter.segmentParams = segmentFilter.params
      }

      const formType =
        form_type === 'zip' ||
        form_type === 'single' ||
        form_type === 'multiple' ||
        form_type === 'none'
          ? form_type
          : 'single'

      const hasRedirect =
        formType === 'zip'
          ? await landingPageHasRedirect(workspace_id)
          : false

      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        emptyValue: emptyAnalyticsFunnel(parsed.rangeId, formType),
        run: () =>
          getAnalyticsFunnel({
            workspaceId: workspace_id,
            rangeId: parsed.rangeId,
            formType,
            hasRedirect,
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
      limit?: string
      offset?: string
    }
  }>(
    '/v1/analytics/funnel/leads',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['workspace_id'],
          properties: {
            workspace_id: { type: 'string', format: 'uuid' },
            range_id: rangeIdSchema,
            ...customRangeSchemaProps,
            limit: { type: 'string', maxLength: 4 },
            offset: { type: 'string', maxLength: 8 },
          },
        },
      },
      config: ANALYTICS_RATE_LIMIT,
    },
    async (request, reply) => {
      const { workspace_id } = request.query
      const parsed = parseRangeQuery(request.query)
      if (!parsed.ok) {
        return reply.code(400).send({ error: parsed.error })
      }
      const limit = Number(request.query.limit ?? 15)
      const offset = Number(request.query.offset ?? 0)

      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        guard: guardFunnelLeadsRequest,
        emptyValue: emptyFunnelLeads(parsed.rangeId, limit, offset),
        run: () =>
          getFunnelLeads({
            workspaceId: workspace_id,
            rangeId: parsed.rangeId,
            custom: parsed.custom,
            limit,
            offset,
          }),
        logLabel: 'analytics funnel leads query ok',
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
      mode?: string
      device?: string
      page_url?: string
    }
  }>(
    '/v1/analytics/heatmap',
    { schema: heatmapSchema, config: ANALYTICS_RATE_LIMIT },
    async (request, reply) => {
      const { workspace_id, page_url } = request.query
      const parsed = parseRangeQuery(request.query)
      if (!parsed.ok) {
        return reply.code(400).send({ error: parsed.error })
      }
      const mode = parseHeatmapMode(request.query.mode)
      const device = parseHeatmapDevice(request.query.device)

      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        emptyValue: emptyAnalyticsHeatmap(parsed.rangeId, mode, device),
        run: () =>
          getAnalyticsHeatmap({
            workspaceId: workspace_id,
            mode,
            device,
            pageUrl: page_url,
            rangeId: parsed.rangeId,
            custom: parsed.custom,
          }),
        logLabel: 'analytics heatmap query ok',
        logContext: { range_id: parsed.rangeId, mode, device },
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
      segment_id?: string
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
      const parsedUtm = parseAnalyticsUtmFilter(request.query)
      const segmentFilter = await resolveSegmentFilter(request.query.segment_id, request.query.workspace_id)
      const utmFilter = parsedUtm || {}
      if (segmentFilter) {
        utmFilter.segmentSql = segmentFilter.sql
        utmFilter.segmentParams = segmentFilter.params
      }

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
      segment_id?: string
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
      const parsedUtm = parseAnalyticsUtmFilter(request.query)
      const segmentFilter = await resolveSegmentFilter(request.query.segment_id, request.query.workspace_id)
      const utmFilter = parsedUtm || {}
      if (segmentFilter) {
        utmFilter.segmentSql = segmentFilter.sql
        utmFilter.segmentParams = segmentFilter.params
      }

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
      segment_id?: string
      split_by?: CohortSplitBy
    }
  }>(
    '/v1/analytics/cohorts',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['workspace_id'],
          properties: {
            workspace_id: { type: 'string', format: 'uuid' },
            segment_id: { type: 'string', format: 'uuid' },
            split_by: {
              type: 'string',
              enum: ['utm_source', 'utm_campaign', 'utm_id'],
            },
          },
        },
      },
      config: ANALYTICS_RATE_LIMIT,
    },
    async (request, reply) => {
      const { workspace_id, segment_id, split_by } = request.query

      let segmentGroup: SegmentGroup | null = null
      if (segment_id) {
        const segment = await getSegmentById(segment_id)
        if (
          segment &&
          segment.landingPageId === workspace_id &&
          segment.conditions
        ) {
          segmentGroup = segment.conditions as SegmentGroup
        }
      }

      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        emptyValue: [] as Awaited<ReturnType<typeof getCohortRetention>>,
        run: () => getCohortRetention(workspace_id, segmentGroup, split_by),
        logLabel: 'analytics cohorts query ok',
        logContext: {
          split_by: split_by ?? 'none',
          segment_id: segment_id ?? null,
        },
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
      segment_id?: string
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
            segment_id: { type: 'string', format: 'uuid' },
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
      const parsedUtm = parseAnalyticsUtmFilter(request.query)
      const segmentFilter = await resolveSegmentFilter(request.query.segment_id, request.query.workspace_id)
      const utmFilter = parsedUtm || {}
      if (segmentFilter) {
        utmFilter.segmentSql = segmentFilter.sql
        utmFilter.segmentParams = segmentFilter.params
      }

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

  server.get<{ Querystring: { workspace_id: string; form_type?: string } }>(
    '/v1/analytics/landing-summary',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['workspace_id'],
          properties: {
            workspace_id: { type: 'string', format: 'uuid' },
            form_type: {
              type: 'string',
              enum: ['zip', 'single', 'multiple', 'none'],
            },
            ...utmFilterSchemaProps,
            segment_id: { type: 'string', format: 'uuid' },
          },
        },
      },
      config: ANALYTICS_RATE_LIMIT,
    },
    async (request, reply) => {
      const { workspace_id, form_type } = request.query
      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        emptyValue: emptyLandingPageCardMetrics(),
        run: () => getLandingPageCardMetrics(workspace_id, form_type),
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
      segment_id?: string
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
            segment_id: { type: 'string', format: 'uuid' },
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
      const parsedUtm = parseAnalyticsUtmFilter(request.query)
      const segmentFilter = await resolveSegmentFilter(request.query.segment_id, request.query.workspace_id)
      const utmFilter = parsedUtm || {}
      if (segmentFilter) {
        utmFilter.segmentSql = segmentFilter.sql
        utmFilter.segmentParams = segmentFilter.params
      }

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

  server.get<{
    Querystring: {
      workspace_id: string
      range_id?: string
      from?: string
      to?: string
    }
  }>(
    '/v1/analytics/web-vitals',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['workspace_id'],
          properties: {
            workspace_id: { type: 'string', format: 'uuid' },
            range_id: rangeIdSchema,
            ...customRangeSchemaProps,
          },
        },
      },
      config: ANALYTICS_RATE_LIMIT,
    },
    async (request, reply) => {
      const { workspace_id } = request.query
      const parsed = parseRangeQuery(request.query)
      if (!parsed.ok) {
        return reply.code(400).send({ error: parsed.error })
      }

      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        emptyValue: emptyAnalyticsWebVitals(parsed.rangeId),
        run: () =>
          getAnalyticsWebVitals({
            workspaceId: workspace_id,
            rangeId: parsed.rangeId,
            custom: parsed.custom,
          }),
        logLabel: 'analytics web-vitals query ok',
        logContext: { range_id: parsed.rangeId },
      })
    },
  )

  server.get<{
    Querystring: {
      workspace_id: string
      section?: string
      range_id?: string
      from?: string
      to?: string
      utm_source?: string
      utm_s1?: string
      segment_id?: string
    }
  }>(
    '/v1/analytics/insights',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['workspace_id'],
          properties: {
            workspace_id: { type: 'string', format: 'uuid' },
            section: {
              type: 'string',
              enum: [
                'volume',
                'source',
                'time',
                'age',
                'dropoff',
                'device',
                'geo',
                'risk',
                'vehicle',
                'quality',
                'experiment',
                'intelligence',
                'level1',
              ],
            },
            range_id: rangeIdSchema,
            ...customRangeSchemaProps,
            ...utmFilterSchemaProps,
            segment_id: { type: 'string', format: 'uuid' },
          },
        },
      },
      config: ANALYTICS_RATE_LIMIT,
    },
    async (request, reply) => {
      const { workspace_id, section: sectionRaw } = request.query
      const parsed = parseRangeQuery(request.query)
      if (!parsed.ok) {
        return reply.code(400).send({ error: parsed.error })
      }
      const section =
        sectionRaw && isInsightSectionId(sectionRaw) ? sectionRaw : 'volume'
      const parsedUtm = parseAnalyticsUtmFilter(request.query)
      const segmentFilter = await resolveSegmentFilter(
        request.query.segment_id,
        request.query.workspace_id,
      )
      const utmFilter = parsedUtm || {}
      if (segmentFilter) {
        utmFilter.segmentSql = segmentFilter.sql
        utmFilter.segmentParams = segmentFilter.params
      }

      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        emptyValue: emptyAnalyticsInsights(section),
        run: () =>
          getAnalyticsInsights({
            workspaceId: workspace_id,
            section,
            rangeId: parsed.rangeId,
            utmFilter,
            custom: parsed.custom,
          }),
        logLabel: 'analytics insights query ok',
        logContext: { range_id: parsed.rangeId, section },
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
