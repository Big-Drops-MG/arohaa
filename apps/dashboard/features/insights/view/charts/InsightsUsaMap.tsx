"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { geoAlbersUsa, geoPath } from "d3-geo"
import { feature } from "topojson-client"
import type { Feature, FeatureCollection, Geometry } from "geojson"
import type { GeometryCollection, Topology } from "topojson-specification"
import { Minus, Plus, RotateCcw } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import {
  OVERVIEW_MAP_TIER_COLORS,
  OVERVIEW_MAP_TIER_FILLS,
  OVERVIEW_MAP_TIER_IDS,
  OVERVIEW_MAP_TIER_STROKES,
  US_STATE_FIPS_TO_NAME,
  US_STATES_TOPOJSON_URL,
  normalizeUsStateName,
  overviewMapBubbleTier,
  overviewMapBubbleTierForValue,
  type OverviewMapBubbleTier,
} from "@/features/overview/model/us-states"
import type { InsightChartPoint } from "@/features/insights/model/insights"

type UsStatesTopology = Topology<{
  states: GeometryCollection
}>

type MapTransform = {
  k: number
  x: number
  y: number
}

type MapRegion = {
  key: string
  label: string
  value: number
  tier: OverviewMapBubbleTier | null
  pathD: string
}

const MAP_WIDTH = 720
const MAP_HEIGHT = 420
const MIN_ZOOM = 1
const MAX_ZOOM = 12
const ZOOM_STEP = 1.4
const PAN_THRESHOLD_PX = 6
const EMPTY_FILL = "#f8fafc"
const BOUNDARY_STROKE = "#334155"
const IDENTITY_TRANSFORM: MapTransform = { k: 1, x: 0, y: 0 }

function clampZoom(k: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k))
}

function zoomAround(
  current: MapTransform,
  factor: number,
  cx: number,
  cy: number
): MapTransform {
  const nextK = clampZoom(current.k * factor)
  if (nextK === current.k) return current
  const scale = nextK / current.k
  return {
    k: nextK,
    x: cx - (cx - current.x) * scale,
    y: cy - (cy - current.y) * scale,
  }
}

function clientPointInSvg(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const rect = svg.getBoundingClientRect()
  return {
    x: ((clientX - rect.left) / rect.width) * MAP_WIDTH,
    y: ((clientY - rect.top) / rect.height) * MAP_HEIGHT,
  }
}

type InsightsUsaMapProps = {
  points: InsightChartPoint[]
  seriesKeys: string[]
  className?: string
}

export function InsightsUsaMap({
  points,
  seriesKeys,
  className,
}: InsightsUsaMapProps) {
  const metrics = useMemo(
    () => (seriesKeys.length > 0 ? seriesKeys : ["Insured"]),
    [seriesKeys]
  )
  const [metric, setMetric] = useState(metrics[0]!)
  const [collection, setCollection] = useState<FeatureCollection | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const [transform, setTransform] = useState<MapTransform>(IDENTITY_TRANSFORM)
  const [isPanning, setIsPanning] = useState(false)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const transformRef = useRef(transform)
  const panRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)

  useEffect(() => {
    if (!metrics.includes(metric)) setMetric(metrics[0]!)
  }, [metric, metrics])

  useEffect(() => {
    transformRef.current = transform
  }, [transform])

  useEffect(() => {
    let cancelled = false
    void fetch(US_STATES_TOPOJSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`map topology ${res.status}`)
        return res.json() as Promise<UsStatesTopology>
      })
      .then((topo) => {
        if (cancelled) return
        setCollection(feature(topo, topo.objects.states) as FeatureCollection)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const svg = svgRef.current
      if (!svg) return
      const point = clientPointInSvg(svg, event.clientX, event.clientY)
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      setTransform((current) => zoomAround(current, factor, point.x, point.y))
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  const valueByState = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of points) {
      const name = normalizeUsStateName(String(row.state ?? row.label ?? ""))
      if (!name) continue
      const value = Number(row[metric] ?? 0)
      if (!Number.isFinite(value)) continue
      map.set(name, value)
    }
    return map
  }, [metric, points])

  // Same absolute % slabs as Overview FSR / bounce map scale.
  const { thresholds, legendLabels, minLabel, maxLabel } = useMemo(
    () => overviewMapBubbleTier("fsr"),
    []
  )

  const projection = useMemo(() => {
    const proj = geoAlbersUsa()
    if (!collection || collection.features.length === 0) {
      return proj.translate([MAP_WIDTH / 2, MAP_HEIGHT / 2]).scale(900)
    }
    return proj.fitSize([MAP_WIDTH, MAP_HEIGHT], collection)
  }, [collection])

  const path = useMemo(() => geoPath(projection), [projection])

  const regions = useMemo((): MapRegion[] => {
    if (!collection) return []
    return collection.features.flatMap((feat) => {
      const fips = String(feat.id ?? "")
      const name = US_STATE_FIPS_TO_NAME[fips]
      if (!name) return []
      const d = path(feat as Feature<Geometry>)
      if (!d) return []
      const value = valueByState.get(name) ?? 0
      return [
        {
          key: name,
          label: name,
          value,
          tier:
            value > 0 ? overviewMapBubbleTierForValue(value, thresholds) : null,
          pathD: d,
        },
      ]
    })
  }, [collection, path, thresholds, valueByState])

  const hoveredRegion = hovered
    ? (regions.find((r) => r.key === hovered) ?? null)
    : null

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const el = viewportRef.current
    if (!el) return
    el.setPointerCapture(event.pointerId)
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: transformRef.current.x,
      originY: transformRef.current.y,
      moved: false,
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panRef.current
    if (!pan || pan.pointerId !== event.pointerId) return
    const dx = event.clientX - pan.startX
    const dy = event.clientY - pan.startY
    if (!pan.moved && Math.hypot(dx, dy) < PAN_THRESHOLD_PX) return
    pan.moved = true
    setIsPanning(true)
    setTransform((current) => ({
      ...current,
      x: pan.originX + dx,
      y: pan.originY + dy,
    }))
  }

  function endPan(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panRef.current
    if (!pan || pan.pointerId !== event.pointerId) return
    panRef.current = null
    setIsPanning(false)
    try {
      viewportRef.current?.releasePointerCapture(event.pointerId)
    } catch {
      /* already released */
    }
  }

  if (loadError) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
        Map could not be loaded
      </div>
    )
  }

  return (
    <div className={cn("flex min-h-[320px] flex-col gap-3", className)}>
      <div
        role="group"
        aria-label="Map metric"
        className="inline-grid w-fit grid-flow-col gap-0.5 rounded-full border border-neutral-200/80 bg-neutral-100/90 p-1"
      >
        {metrics.map((id) => {
          const active = metric === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => setMetric(id)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-medium tracking-tight transition-colors",
                active
                  ? "bg-white text-neutral-950 shadow-sm ring-1 ring-black/5"
                  : "text-neutral-500 hover:text-neutral-800"
              )}
            >
              {id}
            </button>
          )
        })}
      </div>

      <div
        ref={viewportRef}
        className={cn(
          "relative min-h-[300px] flex-1 overflow-hidden rounded-lg border border-neutral-200 bg-slate-50",
          isPanning ? "cursor-grabbing" : "cursor-grab"
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        {!collection ? (
          <div className="absolute inset-0 animate-pulse bg-neutral-100/80" />
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            className="h-full w-full touch-none"
            role="img"
            aria-label={`${metric} by US state`}
          >
            <g
              transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}
            >
              {regions.map((region) => {
                const isHover = hovered === region.key
                const fill = region.tier
                  ? OVERVIEW_MAP_TIER_FILLS[region.tier]
                  : EMPTY_FILL
                const stroke = region.tier
                  ? OVERVIEW_MAP_TIER_STROKES[region.tier]
                  : BOUNDARY_STROKE
                return (
                  <path
                    key={region.key}
                    d={region.pathD}
                    fill={fill}
                    stroke={isHover ? "#0f172a" : stroke}
                    strokeWidth={
                      isHover ? 1.4 / transform.k : 0.6 / transform.k
                    }
                    onPointerEnter={() => setHovered(region.key)}
                    onPointerLeave={() =>
                      setHovered((current) =>
                        current === region.key ? null : current
                      )
                    }
                  />
                )
              })}
            </g>
          </svg>
        )}

        {hoveredRegion && hoveredRegion.value > 0 ? (
          <div className="pointer-events-none absolute top-3 left-3 rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-xs shadow-sm">
            <p className="font-semibold text-neutral-900">
              {hoveredRegion.label}
            </p>
            <p className="mt-0.5 text-neutral-600 tabular-nums">
              {metric}: {hoveredRegion.value.toFixed(1)}%
            </p>
          </div>
        ) : null}

        <div className="absolute top-3 right-3 flex flex-col gap-1">
          <button
            type="button"
            aria-label="Zoom in"
            className="flex size-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 shadow-sm"
            onClick={() =>
              setTransform((current) =>
                zoomAround(current, ZOOM_STEP, MAP_WIDTH / 2, MAP_HEIGHT / 2)
              )
            }
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            className="flex size-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 shadow-sm"
            onClick={() =>
              setTransform((current) =>
                zoomAround(
                  current,
                  1 / ZOOM_STEP,
                  MAP_WIDTH / 2,
                  MAP_HEIGHT / 2
                )
              )
            }
          >
            <Minus className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Reset map"
            className="flex size-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 shadow-sm"
            onClick={() => setTransform(IDENTITY_TRANSFORM)}
          >
            <RotateCcw className="size-4" />
          </button>
        </div>

        <div className="absolute right-3 bottom-3 rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 shadow-sm">
          <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {metric}
          </p>
          <div className="flex items-end gap-0.5">
            {OVERVIEW_MAP_TIER_IDS.map((tier) => (
              <div
                key={tier}
                className="h-3 w-4 rounded-sm"
                style={{ backgroundColor: OVERVIEW_MAP_TIER_COLORS[tier] }}
                title={legendLabels[tier]}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between gap-4 text-[10px] text-muted-foreground tabular-nums">
            <span>{minLabel}</span>
            <span>{maxLabel}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
