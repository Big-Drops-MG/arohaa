/**
 * Builds per-state Census place GeoJSON for city-level choropleth maps.
 * Run: pnpm geo:build
 */
import AdmZip from "adm-zip"
import { createWriteStream, existsSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { open as openShapefile } from "shapefile"
import type { Feature, FeatureCollection } from "geojson"

const __dirname = dirname(fileURLToPath(import.meta.url))
const cacheDir = resolve(__dirname, "../../.cache/geo")
const placesOutDir = resolve(
  __dirname,
  "../../apps/dashboard/public/geo/places"
)
const zipPath = resolve(cacheDir, "cb_2024_us_place_500k.zip")
const shpPath = resolve(cacheDir, "cb_2024_us_place_500k.shp")

const US_STATE_FIPS_TO_NAME: Record<string, string> = {
  "01": "Alabama",
  "02": "Alaska",
  "04": "Arizona",
  "05": "Arkansas",
  "06": "California",
  "08": "Colorado",
  "09": "Connecticut",
  "10": "Delaware",
  "11": "District of Columbia",
  "12": "Florida",
  "13": "Georgia",
  "15": "Hawaii",
  "16": "Idaho",
  "17": "Illinois",
  "18": "Indiana",
  "19": "Iowa",
  "20": "Kansas",
  "21": "Kentucky",
  "22": "Louisiana",
  "23": "Maine",
  "24": "Maryland",
  "25": "Massachusetts",
  "26": "Michigan",
  "27": "Minnesota",
  "28": "Mississippi",
  "29": "Missouri",
  "30": "Montana",
  "31": "Nebraska",
  "32": "Nevada",
  "33": "New Hampshire",
  "34": "New Jersey",
  "35": "New Mexico",
  "36": "New York",
  "37": "North Carolina",
  "38": "North Dakota",
  "39": "Ohio",
  "40": "Oklahoma",
  "41": "Oregon",
  "42": "Pennsylvania",
  "44": "Rhode Island",
  "45": "South Carolina",
  "46": "South Dakota",
  "47": "Tennessee",
  "48": "Texas",
  "49": "Utah",
  "50": "Vermont",
  "51": "Virginia",
  "53": "Washington",
  "54": "West Virginia",
  "55": "Wisconsin",
  "56": "Wyoming",
}

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

const FIPS_TO_STUSPS = Object.fromEntries(
  Object.entries(US_STATE_FIPS_TO_NAME).map(([fips, name]) => [
    fips.padStart(2, "0"),
    US_STATE_NAME_TO_CODE[name] ?? "",
  ])
)

async function downloadPlacesZip(): Promise<void> {
  if (existsSync(zipPath)) return

  await mkdir(cacheDir, { recursive: true })
  const url =
    "https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_place_500k.zip"
  const res = await fetch(url)
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download Census places shapefile: ${res.status}`)
  }

  await new Promise<void>((resolvePromise, reject) => {
    const out = createWriteStream(zipPath)
    const reader = res.body!.getReader()

    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          out.write(Buffer.from(value))
        }
        out.end()
      } catch (err) {
        reject(err)
      }
    }

    out.on("finish", () => resolvePromise())
    out.on("error", reject)
    void pump()
  })
}

function extractPlacesShapefile(): void {
  if (existsSync(shpPath)) return
  const zip = new AdmZip(zipPath)
  zip.extractAllTo(cacheDir, true)
}

async function readPlacesCollection(): Promise<FeatureCollection> {
  const source = await openShapefile(shpPath)
  const features: Feature[] = []

  let result = await source.read()
  while (!result.done) {
    const row = result.value
    const props = (row.properties ?? {}) as Record<string, unknown>
    const statefp = String(props.STATEFP ?? "").padStart(2, "0")
    const stusps = FIPS_TO_STUSPS[statefp]
    if (!stusps) {
      result = await source.read()
      continue
    }

    const geoid = String(props.GEOID ?? "")
    const name = typeof props.NAME === "string" ? props.NAME.trim() : geoid

    features.push({
      type: "Feature",
      id: geoid,
      geometry: row.geometry,
      properties: {
        GEOID: geoid,
        STATEFP: statefp,
        PLACEFP: String(props.PLACEFP ?? ""),
        NAME: name,
        NAMELSAD:
          typeof props.NAMELSAD === "string" ? props.NAMELSAD.trim() : name,
        STUSPS: stusps,
        LSAD: typeof props.LSAD === "string" ? props.LSAD : "",
      },
    })

    result = await source.read()
  }

  return { type: "FeatureCollection", features }
}

async function main() {
  await downloadPlacesZip()
  extractPlacesShapefile()

  const allPlaces = await readPlacesCollection()
  await mkdir(placesOutDir, { recursive: true })

  const byState = new Map<string, Feature[]>()
  for (const feat of allPlaces.features) {
    const stusps = String(
      (feat.properties as Record<string, unknown> | null)?.STUSPS ?? ""
    )
    if (!stusps) continue
    const list = byState.get(stusps) ?? []
    list.push(feat)
    byState.set(stusps, list)
  }

  let total = 0
  for (const [stusps, features] of byState.entries()) {
    const collection: FeatureCollection = {
      type: "FeatureCollection",
      features,
    }
    await writeFile(
      resolve(placesOutDir, `${stusps}.geojson`),
      JSON.stringify(collection)
    )
    total += features.length
  }

  console.log(
    `[geo:places] wrote ${total} places across ${byState.size} states to ${placesOutDir}`
  )
}

main().catch((err) => {
  console.error("[geo:places] failed:", err)
  process.exit(1)
})
