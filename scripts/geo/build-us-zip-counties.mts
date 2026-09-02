/**
 * Builds a ZIP (ZCTA) → county FIPS crosswalk from the Census 2020
 * ZCTA-to-county relationship file.
 * Run: pnpm geo:build (included in root geo:build script)
 */
import { createWriteStream, existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { pipeline } from "node:stream/promises"
import { Readable } from "node:stream"

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = resolve(__dirname, "../../apps/api/data/us-zip-counties.json")
const cacheDir = resolve(__dirname, "../../.cache/geo")
const relPath = resolve(cacheDir, "tab20_zcta520_county20_natl.txt")

const SOURCE_URL =
  "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt"

const ZCTA_COL = 1
const COUNTY_COL = 9
const AREA_LAND_PART_COL = 16

async function ensureRelationshipFile(): Promise<void> {
  if (existsSync(relPath)) return

  await mkdir(cacheDir, { recursive: true })
  const res = await fetch(SOURCE_URL)
  if (!res.ok || !res.body) {
    throw new Error(
      `Failed to download ZCTA/county relationship file: ${res.status}`
    )
  }
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(relPath))
}

async function main() {
  await ensureRelationshipFile()
  const raw = await readFile(relPath, "utf8")

  // A ZCTA can straddle several counties; keep the one holding the most land.
  const best = new Map<string, { county: string; area: number }>()
  // Aggregated land area per ZIP3 prefix so PO-box-only ZIPs (which have no
  // ZCTA of their own) can still resolve to their surrounding county.
  const prefixArea = new Map<string, Map<string, number>>()
  let isHeader = true

  for (const line of raw.split("\n")) {
    if (isHeader) {
      isHeader = false
      continue
    }
    if (!line.trim()) continue

    const cols = line.split("|")
    const zcta = cols[ZCTA_COL]?.trim() ?? ""
    const county = cols[COUNTY_COL]?.trim() ?? ""
    if (zcta.length !== 5 || county.length !== 5) continue

    const parsedArea = Number(cols[AREA_LAND_PART_COL] ?? 0)
    const area = Number.isFinite(parsedArea) ? parsedArea : 0

    const existing = best.get(zcta)
    if (!existing || area > existing.area) {
      best.set(zcta, { county, area })
    }

    const prefix = zcta.slice(0, 3)
    let byCounty = prefixArea.get(prefix)
    if (!byCounty) {
      byCounty = new Map()
      prefixArea.set(prefix, byCounty)
    }
    byCounty.set(county, (byCounty.get(county) ?? 0) + area)
  }

  const zips: Record<string, string> = {}
  for (const zcta of [...best.keys()].sort()) {
    zips[zcta] = best.get(zcta)!.county
  }

  const prefixes: Record<string, string> = {}
  for (const prefix of [...prefixArea.keys()].sort()) {
    const byCounty = prefixArea.get(prefix)!
    let topCounty = ""
    let topArea = -1
    for (const [county, area] of byCounty) {
      if (area > topArea) {
        topArea = area
        topCounty = county
      }
    }
    if (topCounty) prefixes[prefix] = topCounty
  }

  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, JSON.stringify({ zips, prefixes }))

  console.log(
    `[geo:zip-counties] wrote ${Object.keys(zips).length} zip entries and ${Object.keys(prefixes).length} zip3 prefixes to ${outPath}`
  )
}

main().catch((err) => {
  console.error("[geo:zip-counties] failed:", err)
  process.exit(1)
})
