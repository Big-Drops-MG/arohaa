import './instrument.js'

import { randomUUID } from 'node:crypto'
import * as Sentry from '@sentry/node'
import Fastify, { type FastifyError } from 'fastify'
import cors from '@fastify/cors'
import {
  isCorsOriginAllowed,
  resolveAllowedCorsOrigins,
} from './lib/cors-origins.js'
import rateLimit from '@fastify/rate-limit'
import fastifyRedis from '@fastify/redis'
import { redis } from './services/redis.service.js'
import { ingestRoutes } from './routes/ingest.js'
import { healthRoutes } from './routes/health.js'
import { devRoutes } from './routes/dev.js'
import { analyticsRoutes } from './routes/analytics.js'
import { utmRoutes } from './routes/utm.js'
import {
  closeClickHouseClient,
  ensureEventsTable,
  noteClickHouseFailure,
} from './services/clickhouse.service.js'
import { initGeo } from './services/geo.service.js'
import { sendAlertWebhook } from './lib/alert-webhook.js'
import {
  startBufferProcessor,
  stopBufferProcessor,
} from './services/event-buffer.js'
import {
  startQueueDepthMonitor,
  stopQueueDepthMonitor,
} from './services/queue-metrics.service.js'
import {
  startConnectionWarmer,
  stopConnectionWarmer,
} from './services/connection-warmer.service.js'

const TRACE_ID_HEADER = 'x-trace-id'
const TRACE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/

function pickInboundTraceId(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return null
  return TRACE_ID_PATTERN.test(raw) ? raw : null
}

function buildLoggerConfig(): boolean | Record<string, unknown> {
  const isProduction = process.env.NODE_ENV === 'production'
  const awsKeyId = process.env.AWS_ACCESS_KEY_ID?.trim()
  const awsSecret = process.env.AWS_SECRET_ACCESS_KEY?.trim()

  if (isProduction && awsKeyId && awsSecret) {
    return {
      transport: {
        target: 'pino-cloudwatch',
        options: {
          group: '/arohaa/production/fastify-backend',
          stream: 'api-service',
          aws_region: process.env.AWS_REGION?.trim() || 'us-east-1',
          aws_access_key_id: awsKeyId,
          aws_secret_access_key: awsSecret,
          interval: 1_000,
        },
      },
    }
  }

  return true
}

const server = Fastify({
  logger: buildLoggerConfig(),
  trustProxy: true,
  requestIdHeader: TRACE_ID_HEADER,
  genReqId: (req) =>
    pickInboundTraceId(req.headers[TRACE_ID_HEADER]) ?? randomUUID(),
})

server.addHook('onRequest', async (request, reply) => {
  reply.header(TRACE_ID_HEADER, request.id)
})

const isDev = process.env.NODE_ENV !== 'production'

server.register(cors, {
  origin: async (origin: string | undefined) => {
    if (!origin) return false

    const allowed = await resolveAllowedCorsOrigins()
    if (isCorsOriginAllowed(origin, allowed)) {
      return origin
    }
    return false
  },
  credentials: false,
  methods: ['GET', 'POST', 'OPTIONS'],
})


server.removeContentTypeParser('text/plain')
server.addContentTypeParser(
  'text/plain',
  { parseAs: 'string' },
  (_request, body, done) => {
    const raw = typeof body === 'string' ? body.trim() : ''
    if (raw === '') {
      done(null, undefined)
      return
    }
    try {
      done(null, JSON.parse(raw))
    } catch {
      const err = new Error('Invalid JSON body') as FastifyError
      err.statusCode = 400
      done(err, undefined)
    }
  },
)

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

  void sendAlertWebhook({
    title: 'API server error',
    body: `${request.method} ${request.url}\n${error.message}`,
    severity: 'critical',
    source: 'api.onError',
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
server.register(utmRoutes)
server.register(analyticsRoutes)
server.register(healthRoutes)
if (isDev) {
  server.register(devRoutes)
}

const start = async () => {
  try {
    try {
      await ensureEventsTable()
      server.log.info('clickhouse events table verified')
    } catch (err) {
      noteClickHouseFailure()
      server.log.warn(
        { err },
        'clickhouse schema setup failed; API will start but ingest/analytics may fail until ClickHouse is reachable',
      )
    }

    await initGeo(server.log)

    startBufferProcessor({ logger: server.log })
    startQueueDepthMonitor({ logger: server.log })
    startConnectionWarmer({ logger: server.log })

    const port = Number(process.env.PORT) || 3001
    await server.listen({ port, host: '0.0.0.0' })
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
    await stopQueueDepthMonitor()
    stopConnectionWarmer()
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
