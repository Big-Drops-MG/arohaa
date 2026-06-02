import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { isClickHouseUnavailableError } from '../lib/is-clickhouse-unavailable.js'
import {
  resolveInternalApiSecret,
  verifyInternalApiRequest,
} from '../lib/internal-api-secret.js'
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
import { isFunnelRangeId } from '../types/analytics-funnel.js'
import { isTrafficRangeId } from '../types/analytics-traffic.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const DEFAULT_RANGE_ID = '7d' as const

const workspaceSchema = {
  querystring: {
    type: 'object',
    required: ['workspace_id'],
    properties: {
      workspace_id: { type: 'string', format: 'uuid' },
    },
  },
} as const

const rangeSchema = {
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
} as const

function guardAnalyticsRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  workspaceId: string,
): boolean {
  if (!resolveInternalApiSecret()) {
    void reply.code(503).send({ error: 'Analytics not configured on this server' })
    return false
  }

  if (!verifyInternalApiRequest(request.headers['x-arohaa-internal'])) {
    void reply.code(401).send({ error: 'Unauthorized' })
    return false
  }

  if (!UUID_RE.test(workspaceId)) {
    void reply.code(400).send({ error: 'Invalid workspace_id' })
    return false
  }

  return true
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
  if (!guardAnalyticsRequest(request, reply, workspaceId)) return

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
  server.get<{ Querystring: { workspace_id: string } }>(
    '/v1/analytics/overview',
    { schema: workspaceSchema },
    async (request, reply) => {
      const { workspace_id } = request.query
      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        emptyValue: emptyAnalyticsOverview(),
        run: () => getAnalyticsOverview(workspace_id),
        logLabel: 'analytics overview query ok',
      })
    },
  )

  server.get<{ Querystring: { workspace_id: string; range_id?: string } }>(
    '/v1/analytics/traffic',
    { schema: rangeSchema },
    async (request, reply) => {
      const { workspace_id, range_id } = request.query
      const rangeId = range_id?.trim() || DEFAULT_RANGE_ID

      if (!isTrafficRangeId(rangeId)) {
        return reply.code(400).send({ error: 'Invalid range_id' })
      }

      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        emptyValue: emptyAnalyticsTraffic(rangeId),
        run: () => getAnalyticsTraffic({ workspaceId: workspace_id, rangeId }),
        logLabel: 'analytics traffic query ok',
        logContext: { range_id: rangeId },
      })
    },
  )

  server.get<{ Querystring: { workspace_id: string; range_id?: string } }>(
    '/v1/analytics/funnel',
    { schema: rangeSchema },
    async (request, reply) => {
      const { workspace_id, range_id } = request.query
      const rangeId = range_id?.trim() || DEFAULT_RANGE_ID

      if (!isFunnelRangeId(rangeId)) {
        return reply.code(400).send({ error: 'Invalid range_id' })
      }

      await sendAnalyticsQuery({
        request,
        reply,
        workspaceId: workspace_id,
        emptyValue: emptyAnalyticsFunnel(rangeId),
        run: () => getAnalyticsFunnel({ workspaceId: workspace_id, rangeId }),
        logLabel: 'analytics funnel query ok',
        logContext: { range_id: rangeId },
      })
    },
  )

  server.get<{ Querystring: { workspace_id: string } }>(
    '/v1/analytics/landing-summary',
    { schema: workspaceSchema },
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
}
