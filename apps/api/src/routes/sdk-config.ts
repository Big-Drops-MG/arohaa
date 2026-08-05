import type { FastifyInstance } from 'fastify'
import { neon } from '@neondatabase/serverless'
import { resolveFieldBlobKeyB64 } from '../lib/field-blob.js'

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

type SdkConfigRow = {
  heatmapSampleRate: number
  redirectPageUrl: string | null
  redirectHostname: string | null
}

type CacheEntry = SdkConfigRow & { expiresAt: number }

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<SdkConfigRow>>()

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

const EMPTY_CONFIG: SdkConfigRow = {
  heatmapSampleRate: DEFAULT_SAMPLE_RATE,
  redirectPageUrl: null,
  redirectHostname: null,
}

async function loadConfig(landingPageId: string): Promise<SdkConfigRow> {
  const sql = getSql()
  if (!sql) return EMPTY_CONFIG

  const rows = (await sql`
    SELECT
      w."heatmapSampleRate" AS rate,
      lp."redirectPageUrl" AS "redirectPageUrl",
      lp."redirectHostname" AS "redirectHostname"
    FROM landing_page lp
    INNER JOIN workspace w ON w.id = lp."workspaceId"
    WHERE lp.id = ${landingPageId}
      AND lp."deletedAt" IS NULL
      AND w."deletedAt" IS NULL
    LIMIT 1
  `) as Array<{
    rate: number | string | null
    redirectPageUrl: string | null
    redirectHostname: string | null
  }>

  const row = rows[0]
  if (!row) return EMPTY_CONFIG
  return {
    heatmapSampleRate: clampSampleRate(row.rate),
    redirectPageUrl: row.redirectPageUrl?.trim() || null,
    redirectHostname: row.redirectHostname?.trim() || null,
  }
}

async function getConfig(landingPageId: string): Promise<SdkConfigRow> {
  const now = Date.now()
  const cached = cache.get(landingPageId)
  if (cached && cached.expiresAt > now) {
    return {
      heatmapSampleRate: cached.heatmapSampleRate,
      redirectPageUrl: cached.redirectPageUrl,
      redirectHostname: cached.redirectHostname,
    }
  }

  const existing = inflight.get(landingPageId)
  if (existing) return existing

  const promise = loadConfig(landingPageId)
    .then((cfg) => {
      cache.set(landingPageId, {
        ...cfg,
        expiresAt: Date.now() + CACHE_TTL_MS,
      })
      inflight.delete(landingPageId)
      return cfg
    })
    .catch(() => {
      cache.set(landingPageId, {
        ...EMPTY_CONFIG,
        expiresAt: Date.now() + ERROR_TTL_MS,
      })
      inflight.delete(landingPageId)
      return EMPTY_CONFIG
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

      const cfg = await getConfig(wid)
      const ck = resolveFieldBlobKeyB64()
      return reply.send({
        heatmap_sample_rate: cfg.heatmapSampleRate,
        redirect_page_url: cfg.redirectPageUrl,
        redirect_hostname: cfg.redirectHostname,
        ...(ck ? { ck } : {}),
      })
    },
  )
}
