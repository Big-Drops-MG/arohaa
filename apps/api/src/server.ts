import Fastify from 'fastify';
import { db, clickhouse } from '@workspace/database';

const server = Fastify({ logger: true });

const uuidPattern =
  '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$';

const ingestSchema = {
  body: {
    type: 'object',
    required: ['workspace_id', 'event_name', 'url'],
    properties: {
      workspace_id: { type: 'string', pattern: uuidPattern },
      session_id: { type: 'string' },
      event_name: { type: 'string' },
      url: { type: 'string', minLength: 1, pattern: '^https?://' },
      referrer: { type: 'string' },
      browser: { type: 'string' },
      os: { type: 'string' },
      device: { type: 'string' },
    },
  },
};

server.post('/ingest', { schema: ingestSchema }, async (request, reply) => {
  const payload = request.body as Record<string, unknown>;

  server.log.info({ msg: 'Valid payload received', data: payload });
  void clickhouse;
  void db;

  return reply.code(202).send({ success: true, message: 'Event queued for ingestion' });
});

server.get('/health', async () => {
  return { status: 'ok', service: 'arohaa-ingestion-api' };
});

const start = async () => {
  try {
    await server.listen({ port: 3001, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
