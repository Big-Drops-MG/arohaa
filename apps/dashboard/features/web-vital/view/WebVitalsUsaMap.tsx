"use client"

import { useEffect, useMemo, useState } from "react"
import { geoAlbersUsa, geoPath } from "d3-geo"
import { feature } from "topojson-client"
import type { FeatureCollection } from "geojson"
import type { GeometryCollection, Topology } from "topojson-specification"
import { cn } from "@workspace/ui/lib/utils"
import {
  US_STATE_FIPS_TO_NAME,
  US_STATES_TOPOJSON_URL,
  normalizeUsStateName,
} from "@/features/overview/model/us-states"
import type { WebVitalStateMetric } from "@/features/web-vital/model/web-vital"

type UsStatesTopology = Topology<{
  states: GeometryCollection
}>

type WebVitalsUsaMapProps = {
  states: WebVitalStateMetric[]
  className?: string
}

const MAP_WIDTH = 720
const MAP_HEIGHT = 420
const EMPTY_FILL = "#f8fafc"
const BOUNDARY_STROKE = "#334155"

/** Worse (red) → better (green) for performance score. */
const SCORE_COLORS = [
  "#dc2626",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#16a34a",
  "#15803d",
] as const

function colorForValue(value: number | null, min: number, max: number): string {
  if (value == null || !Number.isFinite(value)) return EMPTY_FILL
  if (max <= min) return SCORE_COLORS[8]!
  const t = Math.min(1, Math.max(0, (value - min) / (max - min)))
  const idx = Math.min(
    SCORE_COLORS.length - 1,
    Math.floor(t * SCORE_COLORS.length)
  )
  return SCORE_COLORS[idx]!
}

export function WebVitalsUsaMap({ states, className }: WebVitalsUsaMapProps) {
  const [collection, setCollection] = useState<FeatureCollection | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(US_STATES_TOPOJSON_URL)
        if (!res.ok) throw new Error("topojson fetch failed")
        const topo = (await res.json()) as UsStatesTopology
        const fc = feature(topo, topo.objects.states) as FeatureCollection
        if (!cancelled) setCollection(fc)
      } catch {
        if (!cancelled) setLoadError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const byState = useMemo(() => {
    const map = new Map<string, WebVitalStateMetric>()
    for (const row of states) {
      const name = normalizeUsStateName(row.state)
      if (name) map.set(name, row)
    }
    return map
  }, [states])

  const { min, max } = useMemo(() => {
    const values = states
      .map((row) => row.performanceScore)
      .filter((v): v is number => v != null && Number.isFinite(v))
    if (values.length === 0) return { min: 0, max: 0 }
    return { min: Math.min(...values), max: Math.max(...values) }
  }, [states])

  const path = useMemo(() => {
    if (!collection) return null
    const projection = geoAlbersUsa().fitSize(
      [MAP_WIDTH, MAP_HEIGHT],
      collection
    )
    return geoPath(projection)
  }, [collection])

  const regions = useMemo(() => {
    if (!collection || !path) return []
    return collection.features.map((feat) => {
      const fips = String(feat.id ?? "").padStart(2, "0")
      const label = US_STATE_FIPS_TO_NAME[fips] ?? "Unknown"
      const row = byState.get(label)
      const value = row?.performanceScore ?? null
      return {
        key: fips,
        label,
        value,
        samples: row?.samples ?? 0,
        pathD: path(feat) ?? "",
        fill: colorForValue(value, min, max),
      }
    })
  }, [collection, byState, path, min, max])

  const hoveredRegion = hovered ? regions.find((r) => r.key === hovered) : null

  return (
    <div
      className={cn(
        "flex h-full min-h-[320px] flex-col overflow-hidden rounded-xl border border-border bg-white",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">
            Performance by state
          </h3>
          <p className="text-xs text-muted-foreground">
            US field data · performance score
          </p>
        </div>
        {hoveredRegion ? (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-right text-xs">
            <p className="font-medium text-neutral-900">
              {hoveredRegion.label}
            </p>
            <p className="text-neutral-600 tabular-nums">
              {hoveredRegion.value == null
                ? "—"
                : Math.round(hoveredRegion.value)}
              {hoveredRegion.samples > 0
                ? ` · ${hoveredRegion.samples.toLocaleString()} samples`
                : ""}
            </p>
          </div>
        ) : null}
      </div>

      <div className="relative flex flex-1 items-center justify-center p-3">
        {loadError ? (
          <p className="text-sm text-muted-foreground">
            Could not load map geometry.
          </p>
        ) : !collection ? (
          <p className="text-sm text-muted-foreground">Loading map…</p>
        ) : (
          <svg
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            className="h-auto max-h-[380px] w-full"
            role="img"
            aria-label="United States web vitals map"
          >
            {regions.map((region) => (
              <path
                key={region.key}
                d={region.pathD}
                fill={region.fill}
                stroke={BOUNDARY_STROKE}
                strokeWidth={0.6}
                className="cursor-default transition-opacity hover:opacity-90"
                onMouseEnter={() => setHovered(region.key)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
          </svg>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-neutral-100 px-4 py-2.5">
        <span className="text-[10px] text-muted-foreground">Worse</span>
        <div
          className="h-2 flex-1 rounded-full"
          style={{
            background: `linear-gradient(to right, ${SCORE_COLORS.join(", ")})`,
          }}
        />
        <span className="text-[10px] text-muted-foreground">Better</span>
      </div>
    </div>
  )
}
