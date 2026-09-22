import { Redis } from 'ioredis'
import { logger } from './logger.js'

const LOCAL_REDIS_URL = 'redis://127.0.0.1:6379'

export function resolveRedisUrl() {
  const candidates = [
    process.env.REDIS_URL,
    process.env.UPSTASH_REDIS_URL,
    process.env.KV_URL,
  ]

  for (const value of candidates) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('REDIS_URL environment variable is missing.')
  }

  return LOCAL_REDIS_URL
}

export function createRedisClient(role) {
  const client = new Redis(resolveRedisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy(times) {
      return Math.min(times * 200, 30_000)
    },
  })

  client.on('error', (err) => {
    logger.error({ err, redisRole: role }, 'redis connection error')
  })

  client.on('close', () => {
    logger.warn({ redisRole: role }, 'redis connection closed; waiting for reconnect')
  })

  client.on('reconnecting', (delay) => {
    logger.info({ delay, redisRole: role }, 'redis reconnecting')
  })

  return client
}

export async function waitUntilReady(client, role, timeoutMs = 15_000) {
  if (client.status === 'ready') return
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`Redis ready timeout (${role})`))
    }, timeoutMs)

    const onReady = () => {
      cleanup()
      resolve()
    }
    const onError = (err) => {
      cleanup()
      reject(err)
    }
    const cleanup = () => {
      clearTimeout(timer)
      client.off('ready', onReady)
      client.off('error', onError)
    }

    client.once('ready', onReady)
    client.once('error', onError)
  })
}

export async function quitRedisClient(client, role) {
  if (!client) return
  try {
    if (client.status === 'end' || client.status === 'close') return
    await client.quit()
    logger.info({ redisRole: role }, 'redis disconnected')
  } catch (err) {
    logger.warn({ err, redisRole: role }, 'redis quit failed; forcing disconnect')
    try {
      client.disconnect()
    } catch {
      // ignore
    }
  }
}

export function payloadLogMeta(payload) {
  if (typeof payload !== 'string') {
    return { payloadType: typeof payload }
  }
  return {
    payloadBytes: Buffer.byteLength(payload, 'utf8'),
    payloadPrefix: payload.slice(0, 32),
  }
}
