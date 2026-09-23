import { isNull } from 'drizzle-orm'
import { db, landingPages } from '@workspace/database'

const CACHE_TTL_MS = 30_000
const FORCE_REFRESH_COOLDOWN_MS = 5_000

let cachedOrigins: Set<string> | null = null
let cachedAt = 0
let lastForcedRefreshAt = 0

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}

function parseEnvOrigins(): Set<string> {
  const raw = process.env.CORS_ALLOWED_ORIGINS?.trim()
  if (!raw) return new Set()
  return new Set(
    raw
      .split(',')
      .map((part) => normalizeOrigin(part))
      .filter((origin): origin is string => Boolean(origin)),
  )
}

async function loadLandingPageOrigins(): Promise<Set<string>> {
  const rows = await db
    .select({
      origin: landingPages.origin,
      redirectOrigin: landingPages.redirectOrigin,
    })
    .from(landingPages)
    .where(isNull(landingPages.deletedAt))

  const origins = new Set<string>()
  for (const row of rows) {
    const origin = normalizeOrigin(row.origin)
    if (origin) origins.add(origin)
    if (row.redirectOrigin) {
      const redirect = normalizeOrigin(row.redirectOrigin)
      if (redirect) origins.add(redirect)
    }
  }
  return origins
}

export function invalidateAllowedCorsOrigins(): void {
  cachedOrigins = null
  cachedAt = 0
}

export async function resolveAllowedCorsOrigins(
  force = false,
): Promise<Set<string>> {
  const now = Date.now()
  if (!force && cachedOrigins && now - cachedAt < CACHE_TTL_MS) {
    return cachedOrigins
  }

  const allowed = parseEnvOrigins()
  try {
    const fromDb = await loadLandingPageOrigins()
    for (const origin of fromDb) allowed.add(origin)
  } catch {
    if (allowed.size === 0 && process.env.NODE_ENV !== 'production') {
      allowed.add('http://localhost:3000')
      allowed.add('http://127.0.0.1:3000')
    }
  }

  cachedOrigins = allowed
  cachedAt = now
  return allowed
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  allowed: Set<string>,
): boolean {
  if (!origin) return false
  if (process.env.CORS_PERMISSIVE === '1') return true
  if (allowed.size === 0) return false
  return allowed.has(origin)
}

export async function resolveCorsOriginDecision(
  origin: string | undefined,
): Promise<string | false> {
  if (!origin) return false
  if (process.env.CORS_PERMISSIVE === '1') return origin

  let allowed = await resolveAllowedCorsOrigins()
  if (allowed.size === 0) return false
  if (allowed.has(origin)) return origin

  const now = Date.now()
  if (now - lastForcedRefreshAt < FORCE_REFRESH_COOLDOWN_MS) {
    return false
  }
  lastForcedRefreshAt = now
  invalidateAllowedCorsOrigins()
  allowed = await resolveAllowedCorsOrigins(true)
  if (allowed.size === 0) return false
  return allowed.has(origin) ? origin : false
}
