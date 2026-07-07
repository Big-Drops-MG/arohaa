import maxmind, { type CityResponse, type Reader } from 'maxmind'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface GeoInfo {
  country: string
  city: string
}

const UNKNOWN_GEO: GeoInfo = { country: 'Unknown', city: '' }

let reader: Reader<CityResponse> | null = null

interface GeoLogger {
  info: (obj: unknown, msg?: string) => void
  warn: (obj: unknown, msg?: string) => void
}

function candidateDbPaths(): string[] {
  const configured = process.env.GEOIP_DB_PATH?.trim()
  if (configured) return [configured]

  const cwd = process.cwd()
  const apiRoot = fileURLToPath(new URL('../..', import.meta.url))

  return [
    resolve(cwd, 'geoip', 'dbip-city-lite.mmdb'),
    resolve(apiRoot, 'geoip', 'dbip-city-lite.mmdb'),
    resolve(cwd, 'apps', 'api', 'geoip', 'dbip-city-lite.mmdb'),
  ]
}

export async function initGeo(logger?: GeoLogger): Promise<void> {
  for (const dbPath of candidateDbPaths()) {
    if (!existsSync(dbPath)) continue

    try {
      reader = await maxmind.open<CityResponse>(dbPath)
      logger?.info({ dbPath }, 'geoip database loaded')
      return
    } catch (err) {
      logger?.warn({ err, dbPath }, 'geoip database path exists but failed to open')
    }
  }

  reader = null
  logger?.warn(
    { dbPaths: candidateDbPaths() },
    'geoip database not loaded; run pnpm --filter @workspace/api geoip:download',
  )
}

export function lookupGeoIp(ip: string): GeoInfo {
  if (!reader || !ip) return { ...UNKNOWN_GEO }

  const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip
  if (
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized.startsWith('192.168.') ||
    normalized.startsWith('10.')
  ) {
    return { ...UNKNOWN_GEO }
  }

  try {
    const result = reader.get(normalized)
    if (!result) return { ...UNKNOWN_GEO }

    const country = result.country?.names?.en?.trim() || 'Unknown'
    const city = result.city?.names?.en?.trim() || ''
    return { country, city }
  } catch {
    return { ...UNKNOWN_GEO }
  }
}
