import './instrument.js'

import { randomUUID } from 'node:crypto'
import * as Sentry from '@sentry/node'
import Fastify, { type FastifyError } from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import fastifyRedis from '@fastify/redis'
import { redis } from './services/redis.service.js'
import { ingestRoutes } from './routes/ingest.js'
import { healthRoutes } from './routes/health.js'
import { devRoutes } from './routes/dev.js'
import {
  closeClickHouseClient,
  ensureEventsTable,
} from './services/clickhouse.service.js'
import {
  startBufferProcessor,
  stopBufferProcessor,
} from './services/event-buffer.js'

const TRACE_ID_HEADER = 'x-trace-id'
const TRACE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/

function pickInboundTraceId(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return null
  return TRACE_ID_PATTERN.test(raw) ? raw : null
}

const server = Fastify({
  logger: true,
  trustProxy: true,
  requestIdHeader: TRACE_ID_HEADER,
  genReqId: (req) =>
    pickInboundTraceId(req.headers[TRACE_ID_HEADER]) ?? randomUUID(),
})

server.addHook('onRequest', async (request, reply) => {
  reply.header(TRACE_ID_HEADER, request.id)
})

const allowedOrigins = [
  'https://cdn.arohaa.net',
  'https://cdn-dev.arohaa.net',
]

const isDev = process.env.NODE_ENV !== 'production'

const localhostOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

server.register(cors, {
  origin: (origin, cb) => {
    if (!origin) {
      cb(null, true)
      return
    }

    if (allowedOrigins.includes(origin)) {
      cb(null, true)
      return
    }

    if (isDev && localhostOriginPattern.test(origin)) {
      cb(null, true)
      return
    }

    cb(new Error('Not allowed by CORS'), false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
})

server.register(fastifyRedis, { client: redis })

server.register(rateLimit, {
  global: false,
  redis: redis,
  errorResponseBuilder: (request, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: `Rate limit exceeded. Try again in ${context.after}.`,
    trace_id: request.id,
  }),
})

server.addHook('onError', async (request, _reply, error: FastifyError) => {
  const statusCode = error.statusCode ?? 500
  if (statusCode < 500) return

  Sentry.captureException(error, {
    tags: {
      route: request.routeOptions?.url ?? request.url,
      method: request.method,
      trace_id: request.id,
    },
    contexts: {
      request: {
        method: request.method,
        url: request.url,
        trace_id: request.id,
      },
    },
  })
})

server.setErrorHandler((error: FastifyError, request, reply) => {
  const statusCode = error.statusCode ?? 500

  if (statusCode === 429 || error.code === 'FST_ERR_RATE_LIMIT') {
    return reply.status(429).send({
      error: 'Too Many Requests',
      message: error.message,
      trace_id: request.id,
    })
  }

  if (statusCode >= 500) {
    request.log.error({ err: error, url: request.url }, 'unhandled server error')
    return reply.status(statusCode).send({
      error: 'Internal Server Error',
      message:
        'An unexpected error occurred. The incident has been reported.',
    })
  }

  return reply.status(statusCode).send({
    error: error.name || 'Bad Request',
    message: error.message,
  })
})

server.register(ingestRoutes)
server.register(healthRoutes)
if (isDev) {
  server.register(devRoutes)
}

const start = async () => {
  try {
    await ensureEventsTable()
    server.log.info('clickhouse events table verified')

    startBufferProcessor({ logger: server.log })

    await server.listen({ port: 3001, host: '0.0.0.0' })
  } catch (err) {
    server.log.error(err)
    Sentry.captureException(err)
    await Sentry.flush(2000).catch(() => undefined)
    process.exit(1)
  }
}

const shutdown = async (signal: string) => {
  server.log.info({ signal }, 'shutdown signal received')
  try {
    await stopBufferProcessor()
    await server.close()
    await closeClickHouseClient()
    await Sentry.flush(2000).catch(() => undefined)
  } catch (err) {
    server.log.error(err, 'error during shutdown')
  } finally {
    process.exit(0)
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown(signal)
  })
}

start()
