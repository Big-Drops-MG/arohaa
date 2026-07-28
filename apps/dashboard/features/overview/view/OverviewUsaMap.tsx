"use client"

import { useEffect, useMemo, useState } from "react"
import {
  geoAlbers,
  geoAlbersUsa,
  geoBounds,
  geoCentroid,
  geoPath,
} from "d3-geo"
import { feature } from "topojson-client"
import type { Feature, FeatureCollection, Geometry } from "geojson"
import type { GeometryCollection, Topology } from "topojson-specification"
import { ArrowLeft } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import type {
  OverviewCityMetric,
  OverviewDateRangeId,
  OverviewKpiMetricId,
  OverviewStateMetric,
} from "@/features/overview/model/overview"
import {
  OVERVIEW_MAP_TIER_COLORS,
  OVERVIEW_MAP_TIER_SOFT,
  OVERVIEW_MAP_TIER_STROKES,
  US_STATE_FIPS_TO_NAME,
  US_STATE_NAME_TO_FIPS,
  US_STATES_TOPOJSON_URL,
  normalizeUsStateName,
  overviewCityPointInBbox,
  overviewMapBubbleRadius,
  overviewMapBubbleTier,
  overviewMapBubbleTierForValue,
} from "@/features/overview/model/us-states"
import { buildAnalyticsApiPath } from "@/lib/dashboard/analytics-query"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"
import type { DashboardCustomRange } from "@/features/traffic/model/traffic-range"

type UsStatesTopology = Topology<{
  states: GeometryCollection
}>

type OverviewUsaMapProps = {
  metricId: OverviewKpiMetricId
  metricLabel: string
  valueSuffix?: string
  states: OverviewStateMetric[]
  projectId: string
  dateRangeId: OverviewDateRangeId
  customRange?: DashboardCustomRange | null
  className?: string
}

type MapBubble = {
  key: string
  label: string
  value: number
  x: number
  y: number
  r: number
  tier: 0 | 1 | 2 | 3
}

function metricValue(
  row: OverviewStateMetric | OverviewCityMetric,
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

function formatMetricValue(
  value: number,
  metricId: OverviewKpiMetricId
): string {
  if (metricId === "fsr" || metricId === "bounce-rate") {
    return `${value.toFixed(1)}%`
  }
  return value.toLocaleString("en-US")
}

export function OverviewUsaMap({
  metricId,
  metricLabel,
  valueSuffix,
  states,
  projectId,
  dateRangeId,
  customRange,
  className,
}: OverviewUsaMapProps) {
  const { utmFilter } = useDashboardUtmFilter()
  const [collection, setCollection] = useState<FeatureCollection | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const [selectedState, setSelectedState] = useState<string | null>(null)
  const [cities, setCities] = useState<OverviewCityMetric[]>([])
  const [citiesLoading, setCitiesLoading] = useState(false)
  const [citiesError, setCitiesError] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetch(US_STATES_TOPOJSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`map topology ${res.status}`)
        return res.json() as Promise<UsStatesTopology>
      })
      .then((topo) => {
        if (cancelled) return
        const statesObject = topo.objects.states
        const fc = feature(topo, statesObject) as FeatureCollection
        setCollection(fc)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedState) {
      setCities([])
      setCitiesError(false)
      setCitiesLoading(false)
      return
    }

    const controller = new AbortController()
    setCitiesLoading(true)
    setCitiesError(false)

    const url = buildAnalyticsApiPath(
      `/api/landing-pages/${encodeURIComponent(projectId)}/overview/cities`,
      {
        rangeId: dateRangeId,
        customRange,
        utmFilter,
        extra: { state: selectedState },
      }
    )

    void fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`cities ${res.status}`)
        return (await res.json()) as {
          state: string
          cities: OverviewCityMetric[]
        }
      })
      .then((payload) => {
        setCities(Array.isArray(payload.cities) ? payload.cities : [])
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        if (process.env.NODE_ENV === "development") {
          console.error("[overview-map] cities fetch failed", err)
        }
        setCities([])
        setCitiesError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setCitiesLoading(false)
      })

    return () => controller.abort()
  }, [customRange, dateRangeId, projectId, selectedState, utmFilter])

  const valueByState = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of states) {
      const name = normalizeUsStateName(row.state)
      if (!name) continue
      map.set(name, (map.get(name) ?? 0) + metricValue(row, metricId))
    }
    return map
  }, [metricId, states])

  const valueByCity = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of cities) {
      const name = row.city.trim()
      if (!name) continue
      map.set(name, (map.get(name) ?? 0) + metricValue(row, metricId))
    }
    return map
  }, [cities, metricId])

  const selectedFeature = useMemo(() => {
    if (!collection || !selectedState) return null
    const fips = US_STATE_NAME_TO_FIPS[selectedState]
    if (!fips) return null
    return (
      collection.features.find((feat) => String(feat.id ?? "") === fips) ?? null
    )
  }, [collection, selectedState])

  const maxValue = useMemo(() => {
    const source = selectedState ? valueByCity.values() : valueByState.values()
    let max = 0
    for (const value of source) {
      if (value > max) max = value
    }
    return max
  }, [selectedState, valueByCity, valueByState])

  const { thresholds, labels } = useMemo(
    () => overviewMapBubbleTier(maxValue),
    [maxValue]
  )

  const width = 720
  const height = 420

  const projection = useMemo(() => {
    if (selectedFeature) {
      return geoAlbers().fitExtent(
        [
          [28, 28],
          [width - 28, height - 28],
        ],
        selectedFeature as Feature<Geometry>
      )
    }
    const proj = geoAlbersUsa()
    if (!collection || collection.features.length === 0) {
      return proj.translate([width / 2, height / 2]).scale(900)
    }
    return proj.fitSize([width, height], collection)
  }, [collection, selectedFeature])

  const path = useMemo(() => geoPath(projection), [projection])

  const outlineFeatures = useMemo(() => {
    if (!collection) return []
    if (selectedFeature) return [selectedFeature]
    return collection.features
  }, [collection, selectedFeature])

  const bubbles = useMemo((): MapBubble[] => {
    if (!collection) return []

    if (selectedState && selectedFeature) {
      const bbox = geoBounds(selectedFeature as Feature<Geometry>)
      const items = cities.flatMap((row) => {
        const label = row.city.trim()
        if (!label) return []
        const value = valueByCity.get(label) ?? 0
        if (value <= 0) return []
        const [lng, lat] = overviewCityPointInBbox(label, bbox)
        const point = projection([lng, lat])
        if (!point) return []
        const tier = overviewMapBubbleTierForValue(value, thresholds)
        return [
          {
            key: label,
            label,
            value,
            x: point[0],
            y: point[1],
            r: overviewMapBubbleRadius(value, maxValue, 6, 36),
            tier,
          },
        ]
      })
      return items.sort((a, b) => b.r - a.r)
    }

    const items = collection.features.flatMap((feat) => {
      const fips = String(feat.id ?? "")
      const name = US_STATE_FIPS_TO_NAME[fips]
      if (!name) return []
      const value = valueByState.get(name) ?? 0
      if (value <= 0) return []
      const centroid = geoCentroid(feat as Feature<Geometry>)
      const point = projection(centroid)
      if (!point) return []
      const tier = overviewMapBubbleTierForValue(value, thresholds)
      return [
        {
          key: name,
          label: name,
          value,
          x: point[0],
          y: point[1],
          r: overviewMapBubbleRadius(value, maxValue),
          tier,
        },
      ]
    })
    return items.sort((a, b) => b.r - a.r)
  }, [
    cities,
    collection,
    maxValue,
    projection,
    selectedFeature,
    selectedState,
    thresholds,
    valueByCity,
    valueByState,
  ])

  function drillIntoState(stateName: string) {
    const normalized = normalizeUsStateName(stateName)
    if (!normalized) return
    setHovered(null)
    setSelectedState(normalized)
  }

  function backToUsa() {
    setSelectedState(null)
    setHovered(null)
    setCities([])
    setCitiesError(false)
  }

  if (loadError) {
    return (
      <div
        className={cn(
          "flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50/60 px-6 text-sm text-neutral-500",
          className
        )}
      >
        Could not load the USA map outline.
      </div>
    )
  }

  if (!collection) {
    return (
      <div
        className={cn(
          "flex h-full min-h-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50/40",
          className
        )}
        aria-busy
      >
        <div className="h-2/3 w-full max-w-xl animate-pulse rounded-md bg-neutral-200/70" />
      </div>
    )
  }

  const hasBubbles = bubbles.length > 0
  const hoverValue = selectedState
    ? (valueByCity.get(hovered ?? "") ?? 0)
    : (valueByState.get(hovered ?? "") ?? 0)

  return (
    <div className={cn("relative h-full min-h-0 w-full", className)}>
      {selectedState ? (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={backToUsa}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-neutral-800 shadow-sm transition-colors hover:bg-neutral-50"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            USA map
          </button>
          <span className="rounded-lg border border-neutral-200 bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm">
            {selectedState}
          </span>
        </div>
      ) : null}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
        role="img"
        aria-label={
          selectedState
            ? `${metricLabel} by city in ${selectedState}`
            : `${metricLabel} by US state`
        }
      >
        <defs>
          <filter
            id="overview-bubble-glow"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur in="SourceAlpha" stdDeviation="2.4" result="blur" />
            <feOffset dy="0.6" result="offset" />
            <feComponentTransfer in="offset" result="soft">
              <feFuncA type="linear" slope="0.28" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="soft" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {([0, 1, 2, 3] as const).map((tier) => {
            const soft = OVERVIEW_MAP_TIER_SOFT[tier]
            return (
              <radialGradient
                key={tier}
                id={`overview-bubble-fill-${tier}`}
                cx="38%"
                cy="32%"
                r="68%"
              >
                <stop offset="0%" stopColor={soft.core} />
                <stop offset="42%" stopColor={soft.mid} />
                <stop offset="100%" stopColor={soft.edge} />
              </radialGradient>
            )
          })}
        </defs>

        <g>
          {outlineFeatures.map((feat) => {
            const d = path(feat as Feature<Geometry>)
            if (!d) return null
            const fips = String(feat.id ?? "")
            const name = US_STATE_FIPS_TO_NAME[fips]
            const clickable =
              !selectedState &&
              Boolean(name && (valueByState.get(name) ?? 0) > 0)
            return (
              <path
                key={String(feat.id)}
                d={d}
                fill={selectedState ? "#f8fafc" : "#fafafa"}
                stroke={selectedState ? "#94a3b8" : "#d4d4d4"}
                strokeWidth={selectedState ? 1.1 : 0.75}
                className={clickable ? "cursor-pointer" : undefined}
                onClick={() => {
                  if (clickable && name) drillIntoState(name)
                }}
              />
            )
          })}
        </g>

        <g filter="url(#overview-bubble-glow)">
          {bubbles.map((bubble) => {
            const isHovered = hovered === bubble.key
            return (
              <g
                key={bubble.key}
                transform={`translate(${bubble.x} ${bubble.y}) scale(${isHovered ? 1.1 : 1})`}
                className="cursor-pointer"
                onMouseEnter={() => setHovered(bubble.key)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  if (!selectedState) drillIntoState(bubble.label)
                }}
              >
                <circle
                  r={bubble.r}
                  fill={`url(#overview-bubble-fill-${bubble.tier})`}
                  stroke={OVERVIEW_MAP_TIER_STROKES[bubble.tier]}
                  strokeWidth={isHovered ? 1.1 : 0.5}
                >
                  <title>
                    {bubble.label}: {formatMetricValue(bubble.value, metricId)}
                    {valueSuffix &&
                    metricId !== "fsr" &&
                    metricId !== "bounce-rate"
                      ? valueSuffix
                      : ""}
                  </title>
                </circle>
              </g>
            )
          })}
        </g>
      </svg>

      {selectedState && citiesLoading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/40">
          <p className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600 shadow-sm">
            Loading cities…
          </p>
        </div>
      ) : null}

      {!citiesLoading && selectedState && (citiesError || !hasBubbles) ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <p className="max-w-sm text-center text-sm text-neutral-500">
            {citiesError
              ? "Could not load city data for this state."
              : `No city location data for ${selectedState} in this range yet.`}
          </p>
        </div>
      ) : null}

      {!selectedState && !hasBubbles ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <p className="max-w-sm text-center text-sm text-neutral-500">
            No US state location data for this range yet. Bubbles appear once
            GeoIP state is present on events.
          </p>
        </div>
      ) : null}

      {hovered ? (
        <div
          className={cn(
            "pointer-events-none absolute top-3 rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-xs shadow-sm",
            selectedState ? "right-3" : "left-3"
          )}
        >
          <p className="font-semibold text-neutral-900">{hovered}</p>
          <p className="mt-0.5 text-neutral-600">
            {metricLabel}: {formatMetricValue(hoverValue, metricId)}
          </p>
          {!selectedState ? (
            <p className="mt-1 text-[10px] text-neutral-400">Click to expand</p>
          ) : null}
        </div>
      ) : null}

      <div className="absolute right-3 bottom-3 rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-[11px] shadow-sm">
        <p className="mb-1.5 font-semibold tracking-wide text-neutral-700 uppercase">
          {metricLabel}
          {selectedState ? " · Cities" : ""}
        </p>
        <ul className="space-y-1">
          {([0, 1, 2, 3] as const).map((tier) => (
            <li key={tier} className="flex items-center gap-2 text-neutral-600">
              <span
                className="inline-block size-2.5 rounded-full shadow-[0_0_0_2px_rgba(255,255,255,0.7)]"
                style={{
                  background: `radial-gradient(circle at 35% 30%, ${OVERVIEW_MAP_TIER_SOFT[tier].core}, ${OVERVIEW_MAP_TIER_COLORS[tier]})`,
                }}
              />
              <span>{labels[tier]}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
