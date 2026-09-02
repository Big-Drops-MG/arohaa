import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type ZipCountyIndex = {
  zips: Record<string, string>
  prefixes: Record<string, string>
}

let index: ZipCountyIndex | null = null

function candidatePaths(): string[] {
  const configured = process.env.US_ZIP_COUNTY_PATH?.trim()
  if (configured) return [configured]

  const apiRoot = fileURLToPath(new URL('../..', import.meta.url))
  const cwd = process.cwd()

  return [
    resolve(apiRoot, 'data/us-zip-counties.json'),
    resolve(cwd, 'apps/api/data/us-zip-counties.json'),
    resolve(cwd, 'data/us-zip-counties.json'),
  ]
}

function loadIndex(): ZipCountyIndex {
  if (index) return index

  for (const path of candidatePaths()) {
    if (!existsSync(path)) continue
    try {
      const parsed = JSON.parse(
        readFileSync(path, 'utf8'),
      ) as Partial<ZipCountyIndex>
      index = { zips: parsed.zips ?? {}, prefixes: parsed.prefixes ?? {} }
      return index
    } catch {
      // try next path
    }
  }

  index = { zips: {}, prefixes: {} }
  return index
}

export function normalizeUsZip(raw: string): string {
  const digits = raw.trim().replace(/\D/g, '')
  return digits.length >= 5 ? digits.slice(0, 5) : ''
}

/**
 * County FIPS for a US ZIP. Census ZCTAs omit PO-box-only and unique ZIPs, so
 * unmatched ZIPs fall back to the dominant county for their ZIP3 prefix.
 */
export function lookupCountyFipsForZip(rawZip: string): string | null {
  const zip = normalizeUsZip(rawZip)
  if (!zip) return null

  const data = loadIndex()
  return data.zips[zip] ?? data.prefixes[zip.slice(0, 3)] ?? null
}

/**
 * Dominant county across a set of ZIPs. Used to place city rows that have no
 * usable coordinates, where a single ZIP resolves exactly.
 */
export function resolveCountyFipsForZips(
  zipcodes: readonly string[],
): string | undefined {
  const counts = new Map<string, number>()
  for (const zip of zipcodes) {
    const fips = lookupCountyFipsForZip(zip)
    if (!fips) continue
    counts.set(fips, (counts.get(fips) ?? 0) + 1)
  }

  let top: string | undefined
  let topCount = 0
  for (const [fips, count] of counts) {
    if (count > topCount) {
      topCount = count
      top = fips
    }
  }
  return top
}
