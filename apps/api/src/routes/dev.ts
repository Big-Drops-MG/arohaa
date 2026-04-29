import type { FastifyInstance } from 'fastify'
import { sentryEnabled } from '../instrument.js'

export async function devRoutes(server: FastifyInstance) {
  server.get('/v1/_sentry-check', async () => {
    throw new Error('Arohaa Test')
  })

  server.get('/v1/_status', async () => {
    return {
      status: 'ok',
      env: process.env.NODE_ENV ?? 'development',
      sentry: sentryEnabled ? 'enabled' : 'disabled',
    }
  })
}
