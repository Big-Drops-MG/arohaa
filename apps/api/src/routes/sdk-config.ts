import type { FastifyInstance } from 'fastify'
import { neon } from '@neondatabase/serverless'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SDK_CONFIG_RATE_LIMIT = {
  rateLimit: {
    max: 240,
    timeWindow: '1 minute',
  },
} as const

const CACHE_TTL_MS = 60_000
const ERROR_TTL_MS = 10_000
const DEFAULT_SAMPLE_RATE = 1

type CacheEntry = {
  heatmapSampleRate: number
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<number>>()

let sqlSingleton: ReturnType<typeof neon> | null = null

function getSql(): ReturnType<typeof neon> | null {
  if (sqlSingleton) return sqlSingleton
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL
  if (!url) return null
  sqlSingleton = neon(url)
  return sqlSingleton
}

function clampSampleRate(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_SAMPLE_RATE
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

async function loadSampleRate(landingPageId: string): Promise<number> {
  const sql = getSql()
  if (!sql) return DEFAULT_SAMPLE_RATE

  const rows = (await sql`
    SELECT w."heatmapSampleRate" AS rate
    FROM landing_page lp
    INNER JOIN workspace w ON w.id = lp."workspaceId"
    WHERE lp.id = ${landingPageId}
      AND lp."deletedAt" IS NULL
      AND w."deletedAt" IS NULL
    LIMIT 1
  `) as Array<{ rate: number | string | null }>

  const row = rows[0]
  if (!row) return DEFAULT_SAMPLE_RATE
  return clampSampleRate(row.rate)
}

async function getSampleRate(landingPageId: string): Promise<number> {
  const now = Date.now()
  const cached = cache.get(landingPageId)
  if (cached && cached.expiresAt > now) return cached.heatmapSampleRate

  const existing = inflight.get(landingPageId)
  if (existing) return existing

  const promise = loadSampleRate(landingPageId)
    .then((rate) => {
      cache.set(landingPageId, {
        heatmapSampleRate: rate,
        expiresAt: Date.now() + CACHE_TTL_MS,
      })
      inflight.delete(landingPageId)
      return rate
    })
    .catch(() => {
      cache.set(landingPageId, {
        heatmapSampleRate: DEFAULT_SAMPLE_RATE,
        expiresAt: Date.now() + ERROR_TTL_MS,
      })
      inflight.delete(landingPageId)
      return DEFAULT_SAMPLE_RATE
    })

  inflight.set(landingPageId, promise)
  return promise
}

export async function sdkConfigRoutes(server: FastifyInstance) {
  server.get<{ Querystring: { wid: string } }>(
    '/v1/sdk-config',
    {
      config: SDK_CONFIG_RATE_LIMIT,
      schema: {
        querystring: {
          type: 'object',
          required: ['wid'],
          properties: {
            wid: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { wid } = request.query
      if (!UUID_RE.test(wid)) {
        return reply.code(400).send({ error: 'Invalid wid' })
      }

      const heatmap_sample_rate = await getSampleRate(wid)
      return reply.send({ heatmap_sample_rate })
    },
  )
}
