import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ingestRoutes } from './routes/ingest.js';
import { healthRoutes } from './routes/health.js';

const server = Fastify({ logger: true });

const allowedOrigins = [
  'https://cdn.arohaa.com',
  'https://cdn-dev.arohaa.com',
  'http://localhost:3000',
  'http://localhost:3001',
];

server.register(cors, {
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
});
server.register(ingestRoutes);
server.register(healthRoutes);

const start = async () => {
  try {
    await server.listen({ port: 3001, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
