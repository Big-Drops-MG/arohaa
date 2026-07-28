"use client"

import { useEffect, useMemo, useState } from "react"
import { geoAlbersUsa, geoCentroid, geoPath } from "d3-geo"
import { feature } from "topojson-client"
import type { Feature, FeatureCollection, Geometry } from "geojson"
import type { GeometryCollection, Topology } from "topojson-specification"
import { cn } from "@workspace/ui/lib/utils"
import type {
  OverviewKpiMetricId,
  OverviewStateMetric,
} from "@/features/overview/model/overview"
import {
  OVERVIEW_MAP_TIER_COLORS,
  OVERVIEW_MAP_TIER_STROKES,
  US_STATE_FIPS_TO_NAME,
  US_STATES_TOPOJSON_URL,
  normalizeUsStateName,
  overviewMapBubbleRadius,
  overviewMapBubbleTier,
  overviewMapBubbleTierForValue,
} from "@/features/overview/model/us-states"

type UsStatesTopology = Topology<{
  states: GeometryCollection
}>

type OverviewUsaMapProps = {
  metricId: OverviewKpiMetricId
  metricLabel: string
  valueSuffix?: string
  states: OverviewStateMetric[]
  className?: string
}

function metricValue(
  row: OverviewStateMetric,
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
  className,
}: OverviewUsaMapProps) {
  const [collection, setCollection] = useState<FeatureCollection | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)

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

  const valueByState = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of states) {
      const name = normalizeUsStateName(row.state)
      if (!name) continue
      map.set(name, (map.get(name) ?? 0) + metricValue(row, metricId))
    }
    return map
  }, [metricId, states])

  const maxValue = useMemo(() => {
    let max = 0
    for (const value of valueByState.values()) {
      if (value > max) max = value
    }
    return max
  }, [valueByState])

  const { thresholds, labels } = useMemo(
    () => overviewMapBubbleTier(maxValue),
    [maxValue]
  )

  const width = 720
  const height = 420

  const projection = useMemo(() => {
    const proj = geoAlbersUsa()
    if (!collection || collection.features.length === 0) {
      return proj.translate([width / 2, height / 2]).scale(900)
    }
    return proj.fitSize([width, height], collection)
  }, [collection])

  const path = useMemo(() => geoPath(projection), [projection])

  const bubbles = useMemo(() => {
    if (!collection) return []

    return collection.features.flatMap((feat) => {
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
          name,
          value,
          x: point[0],
          y: point[1],
          r: overviewMapBubbleRadius(value, maxValue),
          tier,
        },
      ]
    })
  }, [collection, maxValue, projection, thresholds, valueByState])

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

  return (
    <div className={cn("relative h-full min-h-0 w-full", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
        role="img"
        aria-label={`${metricLabel} by US state`}
      >
        <g>
          {collection.features.map((feat) => {
            const d = path(feat as Feature<Geometry>)
            if (!d) return null
            return (
              <path
                key={String(feat.id)}
                d={d}
                fill="#fafafa"
                stroke="#d4d4d4"
                strokeWidth={0.75}
              />
            )
          })}
        </g>

        <g>
          {bubbles.map((bubble) => (
            <circle
              key={bubble.name}
              cx={bubble.x}
              cy={bubble.y}
              r={bubble.r}
              fill={OVERVIEW_MAP_TIER_COLORS[bubble.tier]}
              stroke={OVERVIEW_MAP_TIER_STROKES[bubble.tier]}
              strokeWidth={1}
              className="cursor-default transition-[r] duration-200"
              onMouseEnter={() => setHovered(bubble.name)}
              onMouseLeave={() => setHovered(null)}
            >
              <title>
                {bubble.name}: {formatMetricValue(bubble.value, metricId)}
                {valueSuffix && metricId !== "fsr" && metricId !== "bounce-rate"
                  ? valueSuffix
                  : ""}
              </title>
            </circle>
          ))}
        </g>
      </svg>

      {!hasBubbles ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <p className="max-w-sm text-center text-sm text-neutral-500">
            No US state location data for this range yet. Bubbles appear once
            GeoIP state is present on events.
          </p>
        </div>
      ) : null}

      {hovered ? (
        <div className="pointer-events-none absolute top-3 left-3 rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-xs shadow-sm">
          <p className="font-semibold text-neutral-900">{hovered}</p>
          <p className="mt-0.5 text-neutral-600">
            {metricLabel}:{" "}
            {formatMetricValue(valueByState.get(hovered) ?? 0, metricId)}
          </p>
        </div>
      ) : null}

      <div className="absolute right-3 bottom-3 rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-[11px] shadow-sm">
        <p className="mb-1.5 font-semibold tracking-wide text-neutral-700 uppercase">
          {metricLabel}
        </p>
        <ul className="space-y-1">
          {([0, 1, 2, 3] as const).map((tier) => (
            <li key={tier} className="flex items-center gap-2 text-neutral-600">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ backgroundColor: OVERVIEW_MAP_TIER_COLORS[tier] }}
              />
              <span>{labels[tier]}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
