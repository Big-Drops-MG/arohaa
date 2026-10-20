import type { FastifyInstance } from 'fastify'
import { verifyInternalApiRequest } from '../lib/internal-api-secret.js'
import { ensureSessionFraudAssessment } from '../lib/lead-fraud/service.js'
import {
  fetchLeadReview,
  fetchLeadReviewHistory,
  upsertLeadReview,
  type LeadAdminDecision,
  type LeadCallOutcome,
  type LeadReviewStatus,
} from '../lib/lead-fraud/lead-review.js'
import { getRelatedSubmissions } from '../lib/lead-fraud/related-submissions.js'
import {
  getWarehouseCalibrationSnapshot,
  getWarehousePartnerScorecards,
  getWarehouseSummary,
} from '../services/warehouse.service.js'

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function warehouseRoutes(server: FastifyInstance) {
  server.get('/v1/warehouse/summary', async (request, reply) => {
    if (!verifyInternalApiRequest(request.headers['x-arohaa-internal'])) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const summary = await getWarehouseSummary()
      return summary
    } catch (err) {
      request.log.error({ err }, 'warehouse summary failed')
      return reply.code(503).send({
        error: 'Warehouse summary unavailable',
      })
    }
  })

  server.get('/v1/warehouse/related-submissions', async (request, reply) => {
    if (!verifyInternalApiRequest(request.headers['x-arohaa-internal'])) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
    const q = request.query as Record<string, unknown>
    const tenantWorkspaceId = asString(q.tenantWorkspaceId)
    const landingPageId = asString(q.landingPageId || q.workspaceId)
    const sessionId = asString(q.sessionId)
    if (!sessionId || !landingPageId) {
      return reply.code(400).send({ error: 'sessionId and landingPageId required' })
    }
    try {
      const result = await getRelatedSubmissions({
        tenantWorkspaceId,
        landingPageId,
        sessionId,
        lookbackDays: Number(q.lookbackDays) || 30,
        limit: Number(q.limit) || 25,
        offset: Number(q.offset) || 0,
      })
      return result
    } catch (err) {
      request.log.error({ err }, 'warehouse related submissions failed')
      return reply.code(503).send({ error: 'Related submissions unavailable' })
    }
  })

  server.get('/v1/warehouse/review', async (request, reply) => {
    if (!verifyInternalApiRequest(request.headers['x-arohaa-internal'])) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
    const q = request.query as Record<string, unknown>
    const tenantWorkspaceId = asString(q.tenantWorkspaceId)
    const workspaceId = asString(q.workspaceId || q.landingPageId)
    const sessionId = asString(q.sessionId)
    if (!tenantWorkspaceId || !workspaceId || !sessionId) {
      return reply
        .code(400)
        .send({ error: 'tenantWorkspaceId, workspaceId and sessionId required' })
    }
    try {
      const review = await fetchLeadReview({
        tenantWorkspaceId,
        workspaceId,
        sessionId,
      })
      return { review }
    } catch (err) {
      request.log.error({ err }, 'warehouse review fetch failed')
      return reply.code(503).send({ error: 'Review unavailable' })
    }
  })

  server.patch('/v1/warehouse/review', async (request, reply) => {
    if (!verifyInternalApiRequest(request.headers['x-arohaa-internal'])) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
    const body = (request.body ?? {}) as Record<string, unknown>
    const tenantWorkspaceId = asString(body.tenantWorkspaceId)
    const workspaceId = asString(body.workspaceId || body.landingPageId)
    const sessionId = asString(body.sessionId)
    if (!tenantWorkspaceId || !workspaceId || !sessionId) {
      return reply
        .code(400)
        .send({ error: 'tenantWorkspaceId, workspaceId and sessionId required' })
    }
    try {
      let assessment = null
      try {
        assessment = await ensureSessionFraudAssessment({
          workspaceId,
          sessionId,
        })
      } catch {
        assessment = null
      }
      const expectedRaw = body.expectedRevision
      const expectedRevision =
        typeof expectedRaw === 'number'
          ? expectedRaw
          : typeof expectedRaw === 'string' && expectedRaw.trim() !== ''
            ? Number(expectedRaw)
            : NaN
      if (!Number.isFinite(expectedRevision)) {
        return reply
          .code(400)
          .send({ error: 'expectedRevision is required (use 0 for first save)' })
      }
      const review = await upsertLeadReview({
        tenantWorkspaceId,
        workspaceId,
        sessionId,
        reviewStatus: asString(body.reviewStatus) as LeadReviewStatus,
        decision: asString(body.decision) as LeadAdminDecision,
        decisionNote: asString(body.decisionNote),
        decisionBy: asString(body.decisionBy) || 'warehouse-admin',
        callOutcome: asString(body.callOutcome) as LeadCallOutcome,
        callOutcomeBy: asString(body.callOutcomeBy) || 'warehouse-admin',
        assessment,
        expectedRevision,
      })
      return { review }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Review update failed'
      if (
        message.startsWith('review_revision_conflict') ||
        message.startsWith('review_revision_required')
      ) {
        return reply.code(409).send({ error: message })
      }
      request.log.error({ err }, 'warehouse review upsert failed')
      return reply.code(503).send({ error: 'Review update failed' })
    }
  })

  server.get('/v1/warehouse/partner-scorecards', async (request, reply) => {
    if (!verifyInternalApiRequest(request.headers['x-arohaa-internal'])) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
    try {
      const cards = await getWarehousePartnerScorecards()
      return { partners: cards }
    } catch (err) {
      request.log.error({ err }, 'warehouse partner scorecards failed')
      return reply.code(503).send({ error: 'Partner scorecards unavailable' })
    }
  })

  server.get('/v1/warehouse/review/history', async (request, reply) => {
    if (!verifyInternalApiRequest(request.headers['x-arohaa-internal'])) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
    const q = request.query as Record<string, unknown>
    const tenantWorkspaceId = asString(q.tenantWorkspaceId)
    const workspaceId = asString(q.workspaceId || q.landingPageId)
    const sessionId = asString(q.sessionId)
    if (!tenantWorkspaceId || !workspaceId || !sessionId) {
      return reply
        .code(400)
        .send({ error: 'tenantWorkspaceId, workspaceId and sessionId required' })
    }
    try {
      return await fetchLeadReviewHistory({
        tenantWorkspaceId,
        workspaceId,
        sessionId,
      })
    } catch (err) {
      request.log.error({ err }, 'warehouse review history failed')
      return reply.code(503).send({ error: 'Review history unavailable' })
    }
  })

  server.get('/v1/warehouse/calibration', async (request, reply) => {
    if (!verifyInternalApiRequest(request.headers['x-arohaa-internal'])) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
    try {
      return await getWarehouseCalibrationSnapshot()
    } catch (err) {
      request.log.error({ err }, 'warehouse calibration failed')
      return reply.code(503).send({ error: 'Calibration unavailable' })
    }
  })
}
