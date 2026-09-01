import {
  geoBounds,
  geoCentroid,
  geoContains,
  geoDistance,
  type GeoPath,
} from "d3-geo"
import type { Feature, FeatureCollection, Geometry } from "geojson"
import type { OverviewKpiMetricId } from "@/features/overview/model/overview"
import type { OverviewCityMetric } from "@/features/overview/model/overview"
import {
  overviewCityPointInBbox,
  overviewMapBubbleTierForValue,
  type OverviewMapBubbleTier,
} from "@/features/overview/model/us-states"

export type OverviewMapCityEntry = {
  label: string
  zipCount: number
  zipcodes: string[]
  value: number
}

export type OverviewMapRegion = {
  key: string
  label: string
  value: number
  tier: OverviewMapBubbleTier | null
  pathD: string
  cityEntries?: OverviewMapCityEntry[]
  totalZipCount?: number
}

function metricValue(
  row:
    | OverviewCityMetric
    | {
        visitors: number
        sessions: number
        pageViews: number
        formSubmitted: number
        fsr: number
        bounceRate: number
      },
  metricId: OverviewKpiMetricId
): number {
  switch (metricId) {
    case "visitors":
      return row.visitors
    case "sessions":
      return row.sessions
    case "page-views":
      return row.pageViews
    case "form-submitted":
      return row.formSubmitted
    case "fsr":
      return row.fsr
    case "bounce-rate":
      return row.bounceRate
  }
}

export function aggregateRegionValues(
  values: number[],
  metricId: OverviewKpiMetricId
): number {
  if (values.length === 0) return 0
  if (metricId === "fsr" || metricId === "bounce-rate") {
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }
  return values.reduce((sum, value) => sum + value, 0)
}

export function resolveCityGeoPoint(
  row: OverviewCityMetric,
  fallbackBbox: [[number, number], [number, number]]
): [number, number] {
  if (
    typeof row.latitude === "number" &&
    typeof row.longitude === "number" &&
    row.latitude !== 0 &&
    row.longitude !== 0
  ) {
    return [row.longitude, row.latitude]
  }
  return overviewCityPointInBbox(row.city.trim(), fallbackBbox)
}

function normalizeCountyId(value: string | number | null | undefined): string {
  const raw = String(value ?? "").trim()
  if (!raw) return ""
  return raw.padStart(5, "0")
}

function nearestFeature(
  point: [number, number],
  features: Feature[]
): Feature | null {
  let best: Feature | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const feat of features) {
    const centroid = geoCentroid(feat as Feature<Geometry>)
    const distance = geoDistance(point, centroid)
    if (distance < bestDistance) {
      bestDistance = distance
      best = feat
    }
  }
  return best
}

type CountyCityBucket = {
  value: number
  zipCount: number
  zipcodes: string[]
}

/**
 * Distinct zipcodes across cities. Zip lists can be capped by the API, so any
 * counted-but-missing zips are added back to keep the total exact.
 */
function distinctZipTotal(entries: OverviewMapCityEntry[]): number {
  const seen = new Set<string>()
  let uncounted = 0
  for (const entry of entries) {
    for (const zip of entry.zipcodes) seen.add(zip)
    uncounted += Math.max(0, entry.zipCount - entry.zipcodes.length)
  }
  return seen.size + uncounted
}

export function buildCountyRegions({
  counties,
  cities,
  metricId,
  thresholds,
  path,
}: {
  counties: FeatureCollection
  cities: OverviewCityMetric[]
  metricId: OverviewKpiMetricId
  thresholds: readonly number[]
  path: GeoPath
}): OverviewMapRegion[] {
  const metricsByCity = new Map<string, CountyCityBucket>()
  for (const row of cities) {
    const name = row.city.trim()
    if (!name) continue
    const zipcodes = Array.isArray(row.zipcodes) ? row.zipcodes : []
    metricsByCity.set(name, {
      value: metricValue(row, metricId),
      zipCount: row.zipCount ?? zipcodes.length,
      zipcodes,
    })
  }

  const countyBuckets = new Map<string, Map<string, CountyCityBucket>>()
  const countiesBbox = geoBounds({
    type: "FeatureCollection",
    features: counties.features,
  } as FeatureCollection)

  for (const row of cities) {
    const label = row.city.trim()
    if (!label) continue
    const metrics = metricsByCity.get(label)
    if (!metrics || (metrics.value <= 0 && metrics.zipCount <= 0)) continue
    const point = resolveCityGeoPoint(row, countiesBbox)
    const contained =
      counties.features.find((feat) =>
        geoContains(feat as Feature<Geometry>, point)
      ) ?? null
    const matched =
      contained ?? nearestFeature(point, counties.features as Feature[])
    if (!matched) continue
    const countyId = normalizeCountyId(matched.id ?? label)
    let cityMap = countyBuckets.get(countyId)
    if (!cityMap) {
      cityMap = new Map()
      countyBuckets.set(countyId, cityMap)
    }
    cityMap.set(label, metrics)
  }

  const regions: OverviewMapRegion[] = []
  for (const feat of counties.features) {
    const d = path(feat as Feature<Geometry>)
    if (!d) continue
    const countyId = normalizeCountyId(feat.id)
    const props = feat.properties as Record<string, unknown> | null | undefined
    const countyLabel =
      typeof props?.NAME === "string"
        ? props.NAME.trim()
        : typeof props?.name === "string"
          ? props.name.trim()
          : countyId
    const cityMap = countyBuckets.get(countyId)
    if (!cityMap) {
      regions.push({
        key: countyId,
        label: countyLabel,
        value: 0,
        tier: null,
        pathD: d,
      })
      continue
    }

    const cityEntries: OverviewMapCityEntry[] = [...cityMap.entries()]
      .map(([cityLabel, bucket]) => ({
        label: cityLabel,
        zipCount: bucket.zipCount,
        zipcodes: bucket.zipcodes,
        value: bucket.value,
      }))
      .sort(
        (a, b) =>
          b.zipCount - a.zipCount ||
          b.value - a.value ||
          a.label.localeCompare(b.label)
      )
    const values = cityEntries.map((entry) => entry.value)
    const value = aggregateRegionValues(values, metricId)
    regions.push({
      key: countyId,
      label: countyLabel,
      value,
      tier: value > 0 ? overviewMapBubbleTierForValue(value, thresholds) : null,
      pathD: d,
      cityEntries,
      totalZipCount: distinctZipTotal(cityEntries),
    })
  }

  return regions
}

export function countyRegionHoverSummary(region: OverviewMapRegion): string {
  if (!region.cityEntries?.length) {
    return `${region.label}: 0`
  }
  const header = `${region.label}: ${region.totalZipCount ?? 0}`
  const lines = region.cityEntries.map(
    (entry) => `- ${entry.label}: ${entry.zipCount}`
  )
  return [header, ...lines].join("\n")
}
