/**
 * Builds US state/county GeoJSON for MapLibre from Census us-atlas TopoJSON.
 * Run: pnpm geo:build
 */
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { FeatureCollection } from "geojson"
import type { GeometryCollection, Topology } from "topojson-specification"

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicOutDir = resolve(__dirname, "../../apps/dashboard/public/geo")
const dataOutDir = resolve(__dirname, "../../apps/dashboard/features/overview/data")

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

async function fetchTopo(url: string): Promise<Topology> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return (await res.json()) as Topology
}

async function topoToFeatureCollection(
  topo: Topology,
  objectName: string
): Promise<FeatureCollection> {
  const { feature } = await import(
    "../../apps/dashboard/node_modules/topojson-client/dist/topojson-client.js"
  )
  const objects = topo.objects as Record<string, GeometryCollection>
  const object = objects[objectName]
  if (!object) {
    throw new Error(`TopoJSON object "${objectName}" not found`)
  }
  return feature(topo, object) as FeatureCollection
}

function enrichStateCollection(
  collection: FeatureCollection
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: collection.features.flatMap((feat) => {
      const fips = String(feat.id ?? "")
      const name = US_STATE_FIPS_TO_NAME[fips]
      if (!name) return []
      const stusps = US_STATE_NAME_TO_CODE[name] ?? ""
      return [
        {
          ...feat,
          properties: {
            ...(feat.properties ?? {}),
            GEOID: fips.padStart(2, "0"),
            STATEFP: fips.padStart(2, "0"),
            NAME: name,
            STUSPS: stusps,
          },
        },
      ]
    }),
  }
}

function enrichCountyCollection(
  collection: FeatureCollection
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: collection.features.map((feat) => {
      const geoid = String(feat.id ?? "")
      const statefp = geoid.slice(0, 2)
      const props = feat.properties as Record<string, unknown> | null
      const name =
        typeof props?.name === "string" ? props.name.trim() : geoid.slice(2)
      return {
        ...feat,
        properties: {
          ...(feat.properties ?? {}),
          GEOID: geoid,
          STATEFP: statefp,
          NAME: name,
        },
      }
    }),
  }
}

async function main() {
  await mkdir(publicOutDir, { recursive: true })
  await mkdir(dataOutDir, { recursive: true })

  const [statesTopo, countiesTopo] = await Promise.all([
    fetchTopo("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"),
    fetchTopo("https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json"),
  ])

  const statesRaw = await topoToFeatureCollection(statesTopo, "states")
  const countiesRaw = await topoToFeatureCollection(countiesTopo, "counties")

  const states = enrichStateCollection(statesRaw)
  const counties = enrichCountyCollection(countiesRaw)

  const statesJson = JSON.stringify(states)
  const countiesJson = JSON.stringify(counties)

  await writeFile(resolve(publicOutDir, "us-states.geojson"), statesJson)
  await writeFile(resolve(publicOutDir, "us-counties.geojson"), countiesJson)
  await writeFile(resolve(dataOutDir, "us-states.geojson"), statesJson)

  console.log(
    `[geo:build] wrote ${states.features.length} states, ${counties.features.length} counties to ${publicOutDir} and ${dataOutDir}`
  )
}

main().catch((err) => {
  console.error("[geo:build] failed:", err)
  process.exit(1)
})
