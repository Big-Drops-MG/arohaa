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

export type OverviewMapRegion = {
  key: string
  label: string
  value: number
  tier: OverviewMapBubbleTier | null
  pathD: string
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
  const valueByCity = new Map<string, number>()
  for (const row of cities) {
    const name = row.city.trim()
    if (!name) continue
    valueByCity.set(
      name,
      (valueByCity.get(name) ?? 0) + metricValue(row, metricId)
    )
  }

  const countyBuckets = new Map<
    string,
    { labels: string[]; values: number[] }
  >()
  const countiesBbox = geoBounds({
    type: "FeatureCollection",
    features: counties.features,
  } as FeatureCollection)

  for (const row of cities) {
    const label = row.city.trim()
    if (!label) continue
    const value = valueByCity.get(label) ?? 0
    if (value <= 0) continue
    const point = overviewCityPointInBbox(label, countiesBbox)
    const contained =
      counties.features.find((feat) =>
        geoContains(feat as Feature<Geometry>, point)
      ) ?? null
    const matched =
      contained ?? nearestFeature(point, counties.features as Feature[])
    if (!matched) continue
    const countyId = String(matched.id ?? label)
    const bucket = countyBuckets.get(countyId)
    if (bucket) {
      bucket.labels.push(label)
      bucket.values.push(value)
    } else {
      countyBuckets.set(countyId, { labels: [label], values: [value] })
    }
  }

  const regions: OverviewMapRegion[] = []
  for (const feat of counties.features) {
    const d = path(feat as Feature<Geometry>)
    if (!d) continue
    const countyId = String(feat.id ?? "")
    const props = feat.properties as Record<string, unknown> | null | undefined
    const countyLabel =
      typeof props?.name === "string" ? props.name.trim() : countyId
    const bucket = countyBuckets.get(countyId)
    if (!bucket) {
      regions.push({
        key: countyId,
        label: countyLabel,
        value: 0,
        tier: null,
        pathD: d,
      })
      continue
    }

    const value = aggregateRegionValues(bucket.values, metricId)
    regions.push({
      key: countyId,
      label: countyLabel,
      value,
      tier: value > 0 ? overviewMapBubbleTierForValue(value, thresholds) : null,
      pathD: d,
    })
  }

  return regions
}
