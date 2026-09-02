import { geoCentroid, geoContains, geoDistance, type GeoPath } from "d3-geo"
import type { Feature, FeatureCollection, Geometry } from "geojson"
import type {
  OverviewCityMetric,
  OverviewKpiMetricId,
} from "@/features/overview/model/overview"
import {
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

/** Raw counters kept per region so rate metrics recompute instead of averaging. */
type RegionTotals = {
  visitors: number
  sessions: number
  pageViews: number
  formSubmitted: number
  bounces: number
}

function emptyTotals(): RegionTotals {
  return {
    visitors: 0,
    sessions: 0,
    pageViews: 0,
    formSubmitted: 0,
    bounces: 0,
  }
}

function ratePct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}

function totalsFromCity(row: OverviewCityMetric): RegionTotals {
  return {
    visitors: row.visitors,
    sessions: row.sessions,
    pageViews: row.pageViews,
    formSubmitted: row.formSubmitted,
    bounces: Math.round((row.bounceRate / 100) * row.sessions),
  }
}

function addTotals(target: RegionTotals, source: RegionTotals): void {
  target.visitors += source.visitors
  target.sessions += source.sessions
  target.pageViews += source.pageViews
  target.formSubmitted += source.formSubmitted
  target.bounces += source.bounces
}

export function regionMetricValue(
  totals: RegionTotals,
  metricId: OverviewKpiMetricId
): number {
  switch (metricId) {
    case "visitors":
      return totals.visitors
    case "sessions":
      return totals.sessions
    case "page-views":
      return totals.pageViews
    case "form-submitted":
      return totals.formSubmitted
    case "fsr":
      return ratePct(totals.formSubmitted, totals.sessions)
    case "bounce-rate":
      return ratePct(totals.bounces, totals.sessions)
  }
}

/**
 * Only real coordinates place a city into a county. Cities without coordinates
 * are left unmapped rather than scattered into arbitrary counties.
 */
export function resolveCityGeoPoint(
  row: OverviewCityMetric
): [number, number] | null {
  const { latitude, longitude } = row
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude === 0 ||
    longitude === 0
  ) {
    return null
  }
  return [longitude, latitude]
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
  label: string
  zipCount: number
  zipcodes: string[]
  totals: RegionTotals
}

/**
 * Coordinates win when present, since they pinpoint the city. Rows without
 * coordinates (typically a form-submitted ZIP with no GeoIP fix) fall back to
 * the county the API resolved from their zipcodes.
 */
function resolveCountyIdForCity(
  row: OverviewCityMetric,
  counties: FeatureCollection,
  countyIdsInState: ReadonlySet<string>
): string {
  const point = resolveCityGeoPoint(row)
  if (point) {
    const contained =
      counties.features.find((feat) =>
        geoContains(feat as Feature<Geometry>, point)
      ) ?? null
    const matched =
      contained ?? nearestFeature(point, counties.features as Feature[])
    const countyId = matched ? normalizeCountyId(matched.id) : ""
    if (countyId) return countyId
  }

  const fromZip = normalizeCountyId(row.countyFips)
  return fromZip && countyIdsInState.has(fromZip) ? fromZip : ""
}

/**
 * Distinct zipcodes across cities. Zip lists can be capped by the API, so any
 * counted-but-missing zips are added back to keep the total exact.
 */
function distinctZipTotal(
  entries: ReadonlyArray<{ zipCount: number; zipcodes: string[] }>
): number {
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
  const countyBuckets = new Map<string, Map<string, CountyCityBucket>>()
  const countyIdsInState = new Set(
    counties.features.map((feat) => normalizeCountyId(feat.id))
  )

  for (const row of cities) {
    const label = row.city.trim()
    if (!label) continue

    const countyId = resolveCountyIdForCity(row, counties, countyIdsInState)
    if (!countyId) continue

    let cityMap = countyBuckets.get(countyId)
    if (!cityMap) {
      cityMap = new Map()
      countyBuckets.set(countyId, cityMap)
    }

    const zipcodes = Array.isArray(row.zipcodes) ? row.zipcodes : []
    const zipCount = row.zipCount ?? zipcodes.length
    const existing = cityMap.get(label)
    if (existing) {
      addTotals(existing.totals, totalsFromCity(row))
      existing.zipCount += zipCount
      existing.zipcodes = [...new Set([...existing.zipcodes, ...zipcodes])]
      continue
    }

    cityMap.set(label, {
      label,
      zipCount,
      zipcodes,
      totals: totalsFromCity(row),
    })
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
    if (!cityMap || cityMap.size === 0) {
      regions.push({
        key: countyId,
        label: countyLabel,
        value: 0,
        tier: null,
        pathD: d,
      })
      continue
    }

    const countyTotals = emptyTotals()
    for (const bucket of cityMap.values()) {
      addTotals(countyTotals, bucket.totals)
    }

    const cityEntries: OverviewMapCityEntry[] = [...cityMap.values()]
      .map((bucket) => ({
        label: bucket.label,
        zipCount: bucket.zipCount,
        zipcodes: bucket.zipcodes,
        value: regionMetricValue(bucket.totals, metricId),
      }))
      .sort(
        (a, b) =>
          b.value - a.value ||
          b.zipCount - a.zipCount ||
          a.label.localeCompare(b.label)
      )

    const value = regionMetricValue(countyTotals, metricId)
    // Rate metrics can legitimately be 0 while the county still has traffic,
    // so activity decides whether a county is shaded.
    const hasActivity =
      countyTotals.sessions > 0 ||
      countyTotals.pageViews > 0 ||
      countyTotals.visitors > 0

    regions.push({
      key: countyId,
      label: countyLabel,
      value,
      tier: hasActivity
        ? overviewMapBubbleTierForValue(value, thresholds)
        : null,
      pathD: d,
      cityEntries,
      totalZipCount: distinctZipTotal(cityEntries),
    })
  }

  return regions
}

export function countyRegionHoverSummary(
  region: OverviewMapRegion,
  formatValue: (value: number) => string
): string {
  const header = `${region.label} County`
  if (!region.cityEntries?.length) {
    return `${header}\nNo city data in this range`
  }
  const lines = region.cityEntries.map((entry) => {
    const zipLabel = entry.zipCount === 1 ? "zip" : "zips"
    return `- ${entry.label}: ${formatValue(entry.value)} (${entry.zipCount} ${zipLabel})`
  })
  return [header, ...lines].join("\n")
}
