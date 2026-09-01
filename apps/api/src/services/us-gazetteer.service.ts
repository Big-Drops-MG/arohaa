import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type GazetteerTuple = [number, number, string]
type GazetteerIndex = Record<string, GazetteerTuple>

let index: GazetteerIndex | null = null

function candidatePaths(): string[] {
  const configured = process.env.US_CITY_GAZETTEER_PATH?.trim()
  if (configured) return [configured]

  const apiRoot = fileURLToPath(new URL('../..', import.meta.url))
  const cwd = process.cwd()

  return [
    resolve(apiRoot, 'data/us-city-gazetteer.json'),
    resolve(cwd, 'apps/api/data/us-city-gazetteer.json'),
    resolve(cwd, 'data/us-city-gazetteer.json'),
  ]
}

function loadIndex(): GazetteerIndex {
  if (index) return index

  for (const path of candidatePaths()) {
    if (!existsSync(path)) continue
    try {
      const raw = readFileSync(path, 'utf8')
      index = JSON.parse(raw) as GazetteerIndex
      return index
    } catch {
      // try next path
    }
  }

  index = {}
  return index
}

export function normalizeGazetteerCityName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+city$/i, '')
    .replace(/\s+town$/i, '')
    .replace(/\s+borough$/i, '')
    .replace(/\s+/g, ' ')
}

function gazetteerKey(stateCode: string, city: string): string {
  return `${stateCode.trim().toUpperCase()}|${normalizeGazetteerCityName(city)}`
}

export function lookupUsCityCoordinates(
  city: string,
  stateCode: string,
): { latitude: number; longitude: number; canonicalName: string } | null {
  const code = stateCode.trim().toUpperCase()
  if (!city.trim() || !code) return null

  const data = loadIndex()
  const direct = data[gazetteerKey(code, city)]
  if (direct) {
    return {
      latitude: direct[0],
      longitude: direct[1],
      canonicalName: direct[2],
    }
  }

  const stPrefix = `${code}|st `
  const saintPrefix = `${code}|saint `
  const normalized = normalizeGazetteerCityName(city)
  if (normalized.startsWith('st ')) {
    const alt = data[`${code}|${normalized.replace(/^st /, 'saint ')}`]
    if (alt) {
      return { latitude: alt[0], longitude: alt[1], canonicalName: alt[2] }
    }
  }
  if (normalized.startsWith('saint ')) {
    const alt = data[`${stPrefix}${normalized.slice(6)}`]
    if (alt) {
      return { latitude: alt[0], longitude: alt[1], canonicalName: alt[2] }
    }
  }

  if (normalized.includes(' city')) {
    const alt = data[gazetteerKey(code, normalized.replace(/\s+city$/, ''))]
    if (alt) {
      return { latitude: alt[0], longitude: alt[1], canonicalName: alt[2] }
    }
  }

  return null
}

export function resolveUsCityCoordinates(input: {
  city: string
  stateCode: string
  latitude?: number | null
  longitude?: number | null
}): { latitude: number; longitude: number } | null {
  const lat = input.latitude ?? 0
  const lng = input.longitude ?? 0
  if (lat !== 0 && lng !== 0 && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { latitude: lat, longitude: lng }
  }

  const lookup = lookupUsCityCoordinates(input.city, input.stateCode)
  if (!lookup) return null
  return { latitude: lookup.latitude, longitude: lookup.longitude }
}
