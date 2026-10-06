import type { FastifyInstance } from 'fastify'
import { verifyInternalApiRequest } from '../lib/internal-api-secret.js'
import { getWarehouseSummary } from '../services/warehouse.service.js'

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
}
