"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
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
import { ArrowLeft, Minus, Plus, RotateCcw } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import type {
  OverviewCityMetric,
  OverviewDateRangeId,
  OverviewKpiMetricId,
  OverviewStateMetric,
} from "@/features/overview/model/overview"
import {
  OVERVIEW_MAP_TIER_COLORS,
  OVERVIEW_MAP_TIER_FILLS,
  OVERVIEW_MAP_TIER_IDS,
  OVERVIEW_MAP_TIER_STROKES,
  US_COUNTIES_TOPOJSON_URL,
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

type UsCountiesTopology = Topology<{
  counties: GeometryCollection
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
  tier: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
}

type MapTransform = {
  k: number
  x: number
  y: number
}

const MAP_WIDTH = 720
const MAP_HEIGHT = 420
const MIN_ZOOM = 1
const MAX_ZOOM = 6
const ZOOM_STEP = 1.35
const IDENTITY_TRANSFORM: MapTransform = { k: 1, x: 0, y: 0 }

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
  const [counties, setCounties] = useState<FeatureCollection | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const [selectedState, setSelectedState] = useState<string | null>(null)
  const [cities, setCities] = useState<OverviewCityMetric[]>([])
  const [citiesLoading, setCitiesLoading] = useState(false)
  const [citiesError, setCitiesError] = useState(false)
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

  transformRef.current = transform

  useEffect(() => {
    let cancelled = false
    void fetch(US_STATES_TOPOJSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`map topology ${res.status}`)
        return res.json() as Promise<UsStatesTopology>
      })
      .then((topo) => {
        if (cancelled) return
        const fc = feature(topo, topo.objects.states) as FeatureCollection
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
      setCounties(null)
      return
    }
    const stateFips = US_STATE_NAME_TO_FIPS[selectedState]
    if (!stateFips) {
      setCounties(null)
      return
    }

    let cancelled = false
    void fetch(US_COUNTIES_TOPOJSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`counties topology ${res.status}`)
        return res.json() as Promise<UsCountiesTopology>
      })
      .then((topo) => {
        if (cancelled) return
        const fc = feature(topo, topo.objects.counties) as FeatureCollection
        const filtered: FeatureCollection = {
          type: "FeatureCollection",
          features: fc.features.filter((feat) =>
            String(feat.id ?? "").startsWith(stateFips)
          ),
        }
        setCounties(filtered)
      })
      .catch(() => {
        if (!cancelled) setCounties(null)
      })

    return () => {
      cancelled = true
    }
  }, [selectedState])

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

  useEffect(() => {
    setTransform(IDENTITY_TRANSFORM)
    setIsPanning(false)
    panRef.current = null
  }, [selectedState])

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

  const { thresholds, minLabel, maxLabel } = useMemo(
    () => overviewMapBubbleTier(maxValue),
    [maxValue]
  )

  const projection = useMemo(() => {
    if (selectedFeature) {
      return geoAlbers().fitExtent(
        [
          [28, 28],
          [MAP_WIDTH - 28, MAP_HEIGHT - 28],
        ],
        selectedFeature as Feature<Geometry>
      )
    }
    const proj = geoAlbersUsa()
    if (!collection || collection.features.length === 0) {
      return proj.translate([MAP_WIDTH / 2, MAP_HEIGHT / 2]).scale(900)
    }
    return proj.fitSize([MAP_WIDTH, MAP_HEIGHT], collection)
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
            r: overviewMapBubbleRadius(value, maxValue, 10, 42),
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
          r: overviewMapBubbleRadius(value, maxValue, 6, 36),
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
    if (panRef.current?.moved) return
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
    setIsPanning(true)
    svg.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const pan = panRef.current
    if (!pan || pan.pointerId !== event.pointerId) return
    const svg = svgRef.current
    if (!svg) return
    const point = clientPointInSvg(svg, event.clientX, event.clientY)
    const dx = point.x - pan.startX
    const dy = point.y - pan.startY
    if (!pan.moved && Math.hypot(dx, dy) > 3) {
      pan.moved = true
      setHovered(null)
    }
    if (!pan.moved) return
    setTransform((current) => ({
      ...current,
      x: pan.originX + dx,
      y: pan.originY + dy,
    }))
  }

  function endPan(event: ReactPointerEvent<SVGSVGElement>) {
    const pan = panRef.current
    if (!pan || pan.pointerId !== event.pointerId) return
    const svg = svgRef.current
    if (svg?.hasPointerCapture(event.pointerId)) {
      svg.releasePointerCapture(event.pointerId)
    }
    // Keep moved flag briefly so click handlers can ignore drag releases.
    window.setTimeout(() => {
      if (panRef.current === pan) panRef.current = null
    }, 0)
    setIsPanning(false)
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
  const canZoomIn = transform.k < MAX_ZOOM - 0.001
  const canZoomOut = transform.k > MIN_ZOOM + 0.001
  const canReset = transform.k !== 1 || transform.x !== 0 || transform.y !== 0

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

      <div ref={viewportRef} className="h-full min-h-0 w-full overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          className={cn(
            "h-full w-full touch-none select-none",
            isPanning ? "cursor-grabbing" : "cursor-grab"
          )}
          role="img"
          aria-label={
            selectedState
              ? `${metricLabel} by city in ${selectedState}`
              : `${metricLabel} by US state`
          }
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPan}
          onPointerCancel={endPan}
        >
          <g
            transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}
          >
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
                    fill="#f8fafc"
                    stroke="#94a3b8"
                    strokeWidth={selectedState ? 1.35 : 0.9}
                    vectorEffect="non-scaling-stroke"
                    className={clickable ? "cursor-pointer" : undefined}
                    onClick={() => {
                      if (clickable && name) drillIntoState(name)
                    }}
                  />
                )
              })}
            </g>

            {selectedState && counties ? (
              <g>
                {counties.features.map((feat) => {
                  const d = path(feat as Feature<Geometry>)
                  if (!d) return null
                  return (
                    <path
                      key={String(feat.id)}
                      d={d}
                      fill="#ffffff"
                      stroke="#cbd5e1"
                      strokeWidth={0.7}
                      vectorEffect="non-scaling-stroke"
                    />
                  )
                })}
              </g>
            ) : null}

            <g>
              {bubbles.map((bubble) => {
                const isHovered = hovered === bubble.key
                const showLabel = selectedState && bubble.r >= 16
                return (
                  <g
                    key={bubble.key}
                    transform={`translate(${bubble.x} ${bubble.y})`}
                    className="cursor-pointer"
                    onMouseEnter={() => {
                      if (!panRef.current?.moved) setHovered(bubble.key)
                    }}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => {
                      if (!selectedState) drillIntoState(bubble.label)
                    }}
                  >
                    <circle
                      r={bubble.r}
                      fill={OVERVIEW_MAP_TIER_FILLS[bubble.tier]}
                      stroke={
                        isHovered
                          ? OVERVIEW_MAP_TIER_STROKES[bubble.tier]
                          : OVERVIEW_MAP_TIER_STROKES[
                              Math.min(8, bubble.tier + 1) as MapBubble["tier"]
                            ]
                      }
                      strokeWidth={isHovered ? 1.6 : selectedState ? 1.25 : 1}
                      vectorEffect="non-scaling-stroke"
                    >
                      <title>
                        {bubble.label}:{" "}
                        {formatMetricValue(bubble.value, metricId)}
                        {valueSuffix &&
                        metricId !== "fsr" &&
                        metricId !== "bounce-rate"
                          ? valueSuffix
                          : ""}
                      </title>
                    </circle>
                    {showLabel ? (
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="pointer-events-none select-none"
                        style={{
                          fontSize: Math.max(8, Math.min(11, bubble.r * 0.42)),
                          fontWeight: 600,
                          fill: bubble.tier >= 5 ? "#f8fafc" : "#0f172a",
                        }}
                      >
                        {bubble.label.length > 12
                          ? `${bubble.label.slice(0, 11)}…`
                          : bubble.label}
                      </text>
                    ) : null}
                  </g>
                )
              })}
            </g>
          </g>
        </svg>
      </div>

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
            "pointer-events-none absolute top-3 left-3 rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-xs shadow-sm",
            selectedState && "mt-12"
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

      <div className="absolute right-3 bottom-3 w-40 rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-[11px] shadow-sm">
        <p className="mb-1.5 font-semibold tracking-wide text-neutral-700 uppercase">
          {metricLabel}
          {selectedState ? " · Cities" : ""}
        </p>
        <div className="flex h-2.5 overflow-hidden rounded-sm border border-neutral-200/80">
          {OVERVIEW_MAP_TIER_IDS.map((tier) => (
            <span
              key={tier}
              className="h-full flex-1"
              style={{ backgroundColor: OVERVIEW_MAP_TIER_COLORS[tier] }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      </div>
    </div>
  )
}
