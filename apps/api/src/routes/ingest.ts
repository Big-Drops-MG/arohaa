import type { FastifyInstance } from 'fastify';

const schema = {
  body: {
    type: 'object',
    required: ['ev', 'wid'],
    properties: {
      ev: { type: 'string' },
      wid: { type: 'string' },
      uid: { type: 'string' },
      sid: { type: 'string' },
      ts: { type: 'number' },
      url: { type: 'string' },
      page: { type: 'string' },
      variant: { type: 'string' },
      formtype: { type: 'string', enum: ['zip', 'single', 'multiple'] },
      props: { type: 'object' },
    },
  },
};

export async function ingestRoutes(server: FastifyInstance) {
  server.post('/v1/ingest', { schema }, async (request, reply) => {
    server.log.info({ msg: 'Event received', data: request.body });
    return reply.code(202).send({ success: true });
  });
}
