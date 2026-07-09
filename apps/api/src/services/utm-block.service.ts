import { neon } from '@neondatabase/serverless'

type StoredUtmParamKey = 'utm_source' | 'utm_s1'

export type BlockedUtmSets = {
  utm_source: Set<string>
  utm_s1: Set<string>
}

export type BlockedUtmLists = {
  utm_source: string[]
  utm_s1: string[]
}

function setsToLists(sets: BlockedUtmSets): BlockedUtmLists {
  return {
    utm_source: [...sets.utm_source].sort(),
    utm_s1: [...sets.utm_s1].sort(),
  }
}

type CacheEntry = {
  sets: BlockedUtmSets
  expiresAt: number
}

const CACHE_TTL_MS = 60_000
const ERROR_TTL_MS = 10_000

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<BlockedUtmSets>>()

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

function emptySets(): BlockedUtmSets {
  return { utm_source: new Set<string>(), utm_s1: new Set<string>() }
}


function sanitizeUtmParamValue(key: StoredUtmParamKey, value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const delimiterIndex = trimmed.search(/[&?#]/)
  const candidate = (
    delimiterIndex === -1 ? trimmed : trimmed.slice(0, delimiterIndex)
  ).trim()
  if (!candidate) return ''

  if (/\butm_[a-z0-9_]+=/i.test(candidate)) return ''
  if (key === 'utm_source' && candidate.includes('=')) return ''

  return candidate
}

async function loadBlockedSets(landingPageId: string): Promise<BlockedUtmSets> {
  const sql = getSql()
  if (!sql) return emptySets()

  const rows = (await sql`
    SELECT key, value
    FROM landing_page_utm_param
    WHERE "landingPageId" = ${landingPageId}
      AND status = 'blocked'
  `) as Array<{ key: string; value: string }>

  const sets = emptySets()
  for (const row of rows) {
    if (row.key === 'utm_source') sets.utm_source.add(row.value)
    else if (row.key === 'utm_s1') sets.utm_s1.add(row.value)
  }
  return sets
}

export async function getBlockedUtmLists(
  landingPageId: string,
): Promise<BlockedUtmLists> {
  const sets = await getBlockedUtmSets(landingPageId)
  return setsToLists(sets)
}

export async function getBlockedUtmSets(
  landingPageId: string,
): Promise<BlockedUtmSets> {
  if (!landingPageId) return emptySets()

  const now = Date.now()
  const cached = cache.get(landingPageId)
  if (cached && cached.expiresAt > now) return cached.sets

  const existing = inflight.get(landingPageId)
  if (existing) return existing

  const promise = loadBlockedSets(landingPageId)
    .then((sets) => {
      cache.set(landingPageId, { sets, expiresAt: Date.now() + CACHE_TTL_MS })
      inflight.delete(landingPageId)
      return sets
    })
    .catch(() => {

      const sets = emptySets()
      cache.set(landingPageId, { sets, expiresAt: Date.now() + ERROR_TTL_MS })
      inflight.delete(landingPageId)
      return sets
    })

  inflight.set(landingPageId, promise)
  return promise
}

export function isUtmBlocked(
  sets: BlockedUtmSets,
  utmSource: string | undefined,
  utmS1: string | undefined,
): boolean {
  if (sets.utm_source.size > 0) {
    const source = sanitizeUtmParamValue('utm_source', utmSource ?? '')
    if (source && sets.utm_source.has(source)) return true
  }
  if (sets.utm_s1.size > 0) {
    const s1 = sanitizeUtmParamValue('utm_s1', utmS1 ?? '')
    if (s1 && sets.utm_s1.has(s1)) return true
  }
  return false
}
