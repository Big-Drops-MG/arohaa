import type { FastifyInstance } from 'fastify';
import { verifyInternalApiRequest } from '../lib/internal-api-secret.js';
import { CLICKHOUSE_EVENTS_TABLE } from '../lib/clickhouse-events-table.js';
import { getClickHouseClient } from '../services/clickhouse.service.js';
import { getSegmentColumnValues } from '../services/segment-column-values.service.js';
import {
  SEGMENT_COLUMN_IDS,
  SegmentCompiler,
  type SegmentGroup,
} from '../services/segment-compiler.service.js';
import {
  createSegment,
  getSegmentsByLandingPage,
  updateSegment,
  deleteSegment,
} from '@workspace/database';

type SegmentConditions = SegmentGroup

export async function segmentRoutes(server: FastifyInstance) {
  server.addHook('onRequest', async (request, reply) => {
    if (!verifyInternalApiRequest(request.headers['x-arohaa-internal'])) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  server.get<{ Querystring: { landing_page_id: string } }>('/v1/segments', async (request, reply) => {
    const { landing_page_id } = request.query;
    if (!landing_page_id) {
      return reply.code(400).send({ error: 'landing_page_id is required' });
    }
    const result = await getSegmentsByLandingPage(landing_page_id);
    return reply.send(result);
  });

  server.post<{
    Body: {
      workspace_id: string
      landing_page_id: string
      name: string
      description?: string
      conditions: SegmentConditions
    }
  }>('/v1/segments', async (request, reply) => {
    const { workspace_id, landing_page_id, name, description, conditions } = request.body;
    if (!workspace_id || !landing_page_id || !name || !conditions) {
      return reply
        .code(400)
        .send({ error: 'workspace_id, landing_page_id, name, and conditions are required' });
    }
    const result = await createSegment({
      workspaceId: workspace_id,
      landingPageId: landing_page_id,
      name,
      description,
      conditions,
    });
    return reply.send(result);
  });

  server.put<{
    Params: { id: string }
    Body: {
      landing_page_id: string
      name?: string
      description?: string
      conditions?: SegmentConditions
    }
  }>('/v1/segments/:id', async (request, reply) => {
    const { id } = request.params;
    const { landing_page_id, ...data } = request.body;
    if (!landing_page_id) {
      return reply.code(400).send({ error: 'landing_page_id is required' });
    }

    const result = await updateSegment(id, landing_page_id, data);
    if (!result) return reply.code(404).send({ error: 'Not found' });
    return reply.send(result);
  });

  server.delete<{ Params: { id: string }; Querystring: { landing_page_id: string } }>('/v1/segments/:id', async (request, reply) => {
    const { id } = request.params;
    const { landing_page_id } = request.query;
    if (!landing_page_id) {
      return reply.code(400).send({ error: 'landing_page_id is required' });
    }

    const result = await deleteSegment(id, landing_page_id);
    if (!result) return reply.code(404).send({ error: 'Not found' });
    return reply.send({ success: true });
  });

  server.get<{
    Querystring: { workspace_id: string; column: string }
  }>('/v1/segments/column-values', async (request, reply) => {
    const { workspace_id, column } = request.query;
    if (!workspace_id || !column) {
      return reply
        .code(400)
        .send({ error: 'workspace_id and column are required' });
    }
    if (!SEGMENT_COLUMN_IDS.includes(column)) {
      return reply.code(400).send({ error: `Unsupported segment column: ${column}` });
    }

    try {
      const values = await getSegmentColumnValues(workspace_id, column);
      return reply.send({ column, values });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load column values';
      request.log.error({ err }, 'segment column values failed');
      return reply.code(400).send({ error: message });
    }
  });

  server.post<{ Body: { workspace_id: string; conditions: SegmentGroup } }>('/v1/segments/preview', async (request, reply) => {
    const { workspace_id, conditions } = request.body;
    if (!workspace_id || !conditions) {
      return reply.code(400).send({ error: 'workspace_id and conditions are required' });
    }

    try {
      const compiler = new SegmentCompiler();
      const compiled = compiler.compile(conditions);

      const ch = getClickHouseClient();

      const p = {
        wid: workspace_id,
        ...compiled.params
      };

      const res = await ch.query({
        format: 'JSON',
        query_params: p,
        query: `
          SELECT count(DISTINCT session_id) as count
          FROM ${CLICKHOUSE_EVENTS_TABLE}
          WHERE workspace_id = {wid: UUID} AND ${compiled.sql}
        `
      });

      const data = await res.json() as { data: { count: string }[] };
      const count = data.data?.[0]?.count ?? "0";
      return reply.send({ count: parseInt(count, 10) });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Segment preview failed';
      request.log.error({ err }, 'segment preview failed');
      return reply.code(400).send({ error: message });
    }
  });
}
