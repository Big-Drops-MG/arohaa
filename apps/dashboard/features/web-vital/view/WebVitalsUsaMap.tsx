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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  US_STATE_FIPS_TO_NAME,
  US_STATES_TOPOJSON_URL,
  normalizeUsStateName,
  overviewMapBubbleTierForValue,
  type OverviewMapBubbleTier,
} from "@/features/overview/model/us-states"
import {
  overviewAnalyticCardContentPaddingClassName,
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"
import type { WebVitalStateMetric } from "@/features/web-vital/model/web-vital"

type UsStatesTopology = Topology<{
  states: GeometryCollection
}>

type WebVitalsUsaMapProps = {
  states: WebVitalStateMetric[]
  className?: string
}

type MapRegion = {
  key: string
  label: string
  value: number
  samples: number
  tier: OverviewMapBubbleTier | null
  pathD: string
}

type MapTransform = {
  k: number
  x: number
  y: number
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
const METRIC_LABEL = "Performance score"

/** Absolute score bands 0–100. */
const SCORE_THRESHOLDS = [10, 20, 30, 40, 50, 60, 70, 85] as const
const LEGEND_LABELS = ["0", "10", "20", "30", "40", "50", "60", "70", "85+"]
const SCORE_TIER_IDS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8,
] as const satisfies readonly OverviewMapBubbleTier[]

/** Worse (red) → better (green) performance score slabs. */
const SCORE_TIER_COLORS: Record<OverviewMapBubbleTier, string> = {
  0: "#b91c1c",
  1: "#dc2626",
  2: "#f97316",
  3: "#f59e0b",
  4: "#eab308",
  5: "#a3e635",
  6: "#4ade80",
  7: "#22c55e",
  8: "#15803d",
}

const SCORE_TIER_STROKES: Record<OverviewMapBubbleTier, string> = {
  0: "#7f1d1d",
  1: "#991b1b",
  2: "#c2410c",
  3: "#b45309",
  4: "#a16207",
  5: "#65a30d",
  6: "#16a34a",
  7: "#15803d",
  8: "#14532d",
}

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
  const x = ((clientX - rect.left) / rect.width) * MAP_WIDTH
  const y = ((clientY - rect.top) / rect.height) * MAP_HEIGHT
  return { x, y }
}

export function WebVitalsUsaMap({ states, className }: WebVitalsUsaMapProps) {
  const [collection, setCollection] = useState<FeatureCollection | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const [transform, setTransform] = useState<MapTransform>(IDENTITY_TRANSFORM)
  const [isPanning, setIsPanning] = useState(false)

  const svgRef = useRef<SVGSVGElement | null>(null)
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
    transformRef.current = transform
  }, [transform])

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

  const valueByState = useMemo(() => {
    const map = new Map<string, { value: number; samples: number }>()
    for (const row of states) {
      const name = normalizeUsStateName(row.state)
      if (!name) continue
      const value = row.performanceScore ?? 0
      map.set(name, { value, samples: row.samples })
    }
    return map
  }, [states])

  const projection = useMemo(() => {
    if (!collection) return null
    return geoAlbersUsa().fitSize([MAP_WIDTH, MAP_HEIGHT], collection)
  }, [collection])

  const path = useMemo(
    () => (projection ? geoPath(projection) : null),
    [projection]
  )

  const regions = useMemo((): MapRegion[] => {
    if (!collection || !path) return []
    return collection.features.flatMap((feat) => {
      const fips = String(feat.id ?? "")
      const name = US_STATE_FIPS_TO_NAME[fips]
      if (!name) return []
      const d = path(feat as Feature<Geometry>)
      if (!d) return []
      const entry = valueByState.get(name)
      const value = entry?.value ?? 0
      return [
        {
          key: name,
          label: name,
          value,
          samples: entry?.samples ?? 0,
          tier:
            value > 0
              ? overviewMapBubbleTierForValue(value, SCORE_THRESHOLDS)
              : null,
          pathD: d,
        },
      ]
    })
  }, [collection, path, valueByState])

  const hasMetricRegions = regions.some((region) => region.tier !== null)

  function wasPanned(): boolean {
    return Boolean(panRef.current?.moved)
  }

  function zoomBy(factor: number) {
    setTransform((current) =>
      zoomAround(current, factor, MAP_WIDTH / 2, MAP_HEIGHT / 2)
    )
  }

  function resetView() {
    setTransform(IDENTITY_TRANSFORM)
  }

  function onPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return
    const svg = svgRef.current
    if (!svg) return
    const point = clientPointInSvg(svg, event.clientX, event.clientY)
    panRef.current = {
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      originX: transformRef.current.x,
      originY: transformRef.current.y,
      moved: false,
    }
  }

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const pan = panRef.current
    if (!pan || pan.pointerId !== event.pointerId) return
    const svg = svgRef.current
    if (!svg) return
    const point = clientPointInSvg(svg, event.clientX, event.clientY)
    const dx = point.x - pan.startX
    const dy = point.y - pan.startY
    if (!pan.moved) {
      if (Math.hypot(dx, dy) <= PAN_THRESHOLD_PX) return
      pan.moved = true
      setHovered(null)
      setIsPanning(true)
      svg.setPointerCapture(event.pointerId)
    }
    setTransform({
      k: transformRef.current.k,
      x: pan.originX + dx,
      y: pan.originY + dy,
    })
  }

  function endPan(event: ReactPointerEvent<SVGSVGElement>) {
    const pan = panRef.current
    if (!pan || pan.pointerId !== event.pointerId) return
    const svg = svgRef.current
    if (svg?.hasPointerCapture(event.pointerId)) {
      svg.releasePointerCapture(event.pointerId)
    }
    window.setTimeout(() => {
      if (panRef.current === pan) panRef.current = null
    }, 0)
    setIsPanning(false)
  }

  const hoveredRegion = hovered
    ? (regions.find((region) => region.key === hovered) ?? null)
    : null
  const canZoomIn = transform.k < MAX_ZOOM - 0.001
  const canZoomOut = transform.k > MIN_ZOOM + 0.001
  const canReset = transform.k !== 1 || transform.x !== 0 || transform.y !== 0

  return (
    <Card
      className={cn(
        overviewCardPointerFocusResetClassName,
        overviewAnalyticCardShellClassName,
        className
      )}
    >
      <CardHeader
        className={cn(
          overviewAnalyticCardHeaderClassName,
          "flex-row flex-wrap items-center gap-2"
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <CardTitle className={overviewSectionHeadingClassName}>
            Performance by state
          </CardTitle>
          <span className="inline-flex max-w-full shrink-0 items-center rounded-full border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700">
            {METRIC_LABEL}
          </span>
        </div>
      </CardHeader>
      <CardContent
        className={cn(
          "relative flex flex-col",
          overviewAnalyticCardContentPaddingClassName
        )}
      >
        <div className="relative h-[320px] w-full min-w-0">
          <div className="absolute inset-0">
            {loadError ? (
              <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50/60 px-6 text-sm text-neutral-500">
                Could not load the USA map outline.
              </div>
            ) : !collection ? (
              <div
                className="flex h-full min-h-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50/40"
                aria-busy
              >
                <div className="h-2/3 w-full max-w-xl animate-pulse rounded-md bg-neutral-200/70" />
              </div>
            ) : (
              <div className="relative h-full min-h-0 w-full">
                <div className="absolute top-3 right-3 z-10 flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white/95 shadow-sm">
                  <button
                    type="button"
                    onClick={() => zoomBy(ZOOM_STEP)}
                    disabled={!canZoomIn}
                    aria-label="Zoom in"
                    className="inline-flex size-8 items-center justify-center text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </button>
                  <div className="h-px bg-neutral-200" />
                  <button
                    type="button"
                    onClick={() => zoomBy(1 / ZOOM_STEP)}
                    disabled={!canZoomOut}
                    aria-label="Zoom out"
                    className="inline-flex size-8 items-center justify-center text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Minus className="size-3.5" aria-hidden />
                  </button>
                  <div className="h-px bg-neutral-200" />
                  <button
                    type="button"
                    onClick={resetView}
                    disabled={!canReset}
                    aria-label="Reset map view"
                    className="inline-flex size-8 items-center justify-center text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                  </button>
                </div>

                <div className="h-full min-h-0 w-full overflow-hidden">
                  <svg
                    ref={svgRef}
                    viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                    preserveAspectRatio="xMidYMid meet"
                    className={cn(
                      "h-full w-full touch-none select-none",
                      isPanning ? "cursor-grabbing" : "cursor-grab"
                    )}
                    role="img"
                    aria-label={`${METRIC_LABEL} by US state`}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={endPan}
                    onPointerCancel={endPan}
                  >
                    <g
                      transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}
                    >
                      {regions.map((region) => {
                        const isHovered = hovered === region.key
                        const fill =
                          region.tier === null
                            ? EMPTY_FILL
                            : SCORE_TIER_COLORS[region.tier]
                        const stroke = isHovered
                          ? SCORE_TIER_STROKES[
                              (region.tier ?? 3) as OverviewMapBubbleTier
                            ]
                          : BOUNDARY_STROKE
                        return (
                          <path
                            key={region.key}
                            d={region.pathD}
                            fill={fill}
                            stroke={stroke}
                            strokeWidth={isHovered ? 2 : 1.35}
                            vectorEffect="non-scaling-stroke"
                            className="cursor-pointer"
                            onMouseEnter={() => {
                              if (!wasPanned()) setHovered(region.key)
                            }}
                            onMouseLeave={() => setHovered(null)}
                          >
                            <title>
                              {region.label}: {Math.round(region.value)}
                            </title>
                          </path>
                        )
                      })}
                    </g>
                  </svg>
                </div>

                {!hasMetricRegions ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
                    <p className="max-w-sm text-center text-sm text-neutral-500">
                      No US state location data for this range yet. Regions fill
                      once GeoIP state is present on web vitals events.
                    </p>
                  </div>
                ) : null}

                {hoveredRegion ? (
                  <div className="pointer-events-none absolute top-3 left-3 rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-xs shadow-sm">
                    <p className="font-semibold text-neutral-900">
                      {hoveredRegion.label}
                    </p>
                    <p className="mt-0.5 text-neutral-600">
                      {METRIC_LABEL}: {Math.round(hoveredRegion.value)}
                    </p>
                    {hoveredRegion.samples > 0 ? (
                      <p className="mt-1 text-[10px] text-neutral-400">
                        {hoveredRegion.samples.toLocaleString()} samples
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="absolute right-3 bottom-3 w-48 rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-[11px] shadow-sm">
                  <p className="mb-1.5 font-semibold tracking-wide text-neutral-700 uppercase">
                    {METRIC_LABEL}
                  </p>
                  <div className="flex h-2.5 overflow-hidden rounded-sm border border-neutral-200/80">
                    {SCORE_TIER_IDS.map((tier) => (
                      <span
                        key={tier}
                        className="h-full flex-1"
                        style={{
                          backgroundColor: SCORE_TIER_COLORS[tier],
                        }}
                        title={
                          tier === 0
                            ? `≤ ${LEGEND_LABELS[1] ?? "10"}`
                            : tier === 8
                              ? (LEGEND_LABELS[8] ?? "85+")
                              : `${LEGEND_LABELS[tier]} – ${String(LEGEND_LABELS[tier + 1] ?? "").replace(/\+$/, "")}`
                        }
                      />
                    ))}
                  </div>
                  <div className="relative mt-1 h-3.5">
                    {LEGEND_LABELS.map((label, index) => {
                      const isEndpoint =
                        index === 0 || index === LEGEND_LABELS.length - 1
                      const isMidTick = index % 2 === 0
                      if (!isEndpoint && !isMidTick) return null
                      const left = (index / (LEGEND_LABELS.length - 1)) * 100
                      return (
                        <span
                          key={`${label}-${index}`}
                          className={cn(
                            "absolute top-0 text-[9px] leading-none text-neutral-500",
                            index === 0
                              ? "translate-x-0"
                              : index === LEGEND_LABELS.length - 1
                                ? "-translate-x-full"
                                : "-translate-x-1/2"
                          )}
                          style={{ left: `${left}%` }}
                        >
                          {label}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
