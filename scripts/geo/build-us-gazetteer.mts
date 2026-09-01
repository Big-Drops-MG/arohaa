/**
 * Builds a compact US city → lat/lng gazetteer from GeoNames.
 * Run: pnpm geo:build (included in root geo:build script)
 */
import { createWriteStream, existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createGunzip } from "node:zlib"
import { pipeline } from "node:stream/promises"
import { Readable } from "node:stream"

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = resolve(__dirname, "../../apps/api/data/us-city-gazetteer.json")
const cacheDir = resolve(__dirname, "../../.cache/geo")
const usTxtPath = resolve(cacheDir, "US.txt")

const US_STATE_NAME_TO_CODE: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  "District of Columbia": "DC",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
}

const POPULATED_PLACE_CODES = new Set([
  "PPL",
  "PPLA",
  "PPLA2",
  "PPLA3",
  "PPLA4",
  "PPLC",
  "PPLCH",
  "PPLF",
  "PPLG",
  "PPLL",
  "PPLR",
  "PPLS",
  "STLMT",
])

type GazetteerRecord = {
  lat: number
  lng: number
  name: string
  population: number
}

function normalizeCityName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+city$/i, "")
    .replace(/\s+town$/i, "")
    .replace(/\s+borough$/i, "")
    .replace(/\s+/g, " ")
}

function gazetteerKey(stateCode: string, city: string): string {
  return `${stateCode.toUpperCase()}|${normalizeCityName(city)}`
}

async function ensureUsTxt(): Promise<void> {
  if (existsSync(usTxtPath)) return

  await mkdir(cacheDir, { recursive: true })
  const url = "https://download.geonames.org/export/dump/US.zip"
  const res = await fetch(url)
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download GeoNames US.zip: ${res.status}`)
  }

  const zipPath = resolve(cacheDir, "US.zip")
  const zipFile = createWriteStream(zipPath)
  await pipeline(Readable.fromWeb(res.body as never), zipFile)

  const { execFile } = await import("node:child_process")
  const { promisify } = await import("node:util")
  const execFileAsync = promisify(execFile)

  if (process.platform === "win32") {
    await execFileAsync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -Path '${zipPath}' -DestinationPath '${cacheDir}' -Force`,
      ],
      { maxBuffer: 10 * 1024 * 1024 }
    )
  } else {
    await execFileAsync("unzip", ["-o", zipPath, "-d", cacheDir], {
      maxBuffer: 10 * 1024 * 1024,
    })
  }
}

async function main() {
  await ensureUsTxt()
  const raw = await readFile(usTxtPath, "utf8")
  const entries = new Map<string, GazetteerRecord>()

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue
    const cols = line.split("\t")
    const name = cols[1]?.trim() ?? ""
    const lat = Number(cols[4])
    const lng = Number(cols[5])
    const featureClass = cols[6]?.trim() ?? ""
    const featureCode = cols[7]?.trim() ?? ""
    const stateCode = cols[10]?.trim().toUpperCase() ?? ""
    const population = Number(cols[14] ?? 0)

    if (featureClass !== "P" || !POPULATED_PLACE_CODES.has(featureCode)) continue
    if (!name || !stateCode || !Number.isFinite(lat) || !Number.isFinite(lng)) continue
    if (!Object.values(US_STATE_NAME_TO_CODE).includes(stateCode)) continue

    const key = gazetteerKey(stateCode, name)
    const existing = entries.get(key)
    if (!existing || population > existing.population) {
      entries.set(key, { lat, lng, name, population })
    }

    const ascii = cols[2]?.trim()
    if (ascii && ascii !== name) {
      const aliasKey = gazetteerKey(stateCode, ascii)
      const aliasExisting = entries.get(aliasKey)
      if (!aliasExisting || population > aliasExisting.population) {
        entries.set(aliasKey, { lat, lng, name, population })
      }
    }
  }

  const aliases: Array<[string, string]> = [
    ["NY|new york city", "NY|new york"],
    ["MO|saint louis", "MO|st louis"],
    ["IN|fort wayne", "IN|ft wayne"],
  ]
  for (const [from, to] of aliases) {
    const target = entries.get(to)
    if (target && !entries.has(from)) {
      entries.set(from, target)
    }
  }

  const compact: Record<string, [number, number, string]> = {}
  for (const [key, value] of entries) {
    compact[key] = [
      Math.round(value.lat * 1_000_000) / 1_000_000,
      Math.round(value.lng * 1_000_000) / 1_000_000,
      value.name,
    ]
  }

  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, JSON.stringify(compact))

  console.log(
    `[geo:gazetteer] wrote ${Object.keys(compact).length} city entries to ${outPath}`
  )
}

main().catch((err) => {
  console.error("[geo:gazetteer] failed:", err)
  process.exit(1)
})
