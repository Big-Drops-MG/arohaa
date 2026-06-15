import maxmind, { type CityResponse, type Reader } from 'maxmind'
import { resolve } from 'node:path'

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

function resolveDbPath(): string {
  const configured = process.env.GEOIP_DB_PATH?.trim()
  if (configured) return configured
  return resolve(process.cwd(), 'geoip', 'dbip-city-lite.mmdb')
}

export async function initGeo(logger?: GeoLogger): Promise<void> {
  const dbPath = resolveDbPath()
  try {
    reader = await maxmind.open<CityResponse>(dbPath)
    logger?.info({ dbPath }, 'geoip database loaded')
  } catch (err) {
    reader = null
    logger?.warn(
      { err, dbPath },
      'geoip database not loaded; geo enrichment will return Unknown',
    )
  }
}

export function lookupGeoIp(ip: string): GeoInfo {
  if (!reader || !ip) return { ...UNKNOWN_GEO }

  try {
    const result = reader.get(ip)
    if (!result) return { ...UNKNOWN_GEO }

    const country = result.country?.names?.en?.trim() || 'Unknown'
    const city = result.city?.names?.en?.trim() || ''
    return { country, city }
  } catch {
    return { ...UNKNOWN_GEO }
  }
}
