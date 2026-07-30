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
  geoContains,
  geoDistance,
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
  OVERVIEW_MAP_TIER_IDS,
  OVERVIEW_MAP_TIER_STROKES,
  US_COUNTIES_TOPOJSON_URL,
  US_STATE_FIPS_TO_NAME,
  US_STATE_NAME_TO_FIPS,
  US_STATES_TOPOJSON_URL,
  normalizeUsStateName,
  overviewCityPointInBbox,
  overviewMapBubbleTier,
  overviewMapBubbleTierForValue,
  type OverviewMapBubbleTier,
} from "@/features/overview/model/us-states"
import { buildAnalyticsApiPath } from "@/lib/dashboard/analytics-query"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"
import { useDashboardSegmentFilter } from "@/hooks/use-dashboard-segment-filter"
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

type MapRegion = {
  key: string
  label: string
  value: number
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
const COUNTY_BOUNDARY_STROKE = "#64748b"
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

function aggregateRegionValues(
  values: number[],
  metricId: OverviewKpiMetricId
): number {
  if (values.length === 0) return 0
  if (metricId === "fsr" || metricId === "bounce-rate") {
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }
  return values.reduce((sum, value) => sum + value, 0)
}

function nearestCountyFeature(
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
  const { segmentId } = useDashboardSegmentFilter()
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
  }, [customRange, dateRangeId, projectId, selectedState, utmFilter, segmentId])

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

  const { thresholds, legendLabels, minLabel, maxLabel } = useMemo(
    () => overviewMapBubbleTier(metricId),
    [metricId]
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

  const stateRegions = useMemo((): MapRegion[] => {
    if (!collection || selectedState) return []
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
  }, [collection, path, selectedState, thresholds, valueByState])

  const cityRegions = useMemo((): MapRegion[] => {
    if (!selectedState || !selectedFeature || !counties) return []

    const bbox = geoBounds(selectedFeature as Feature<Geometry>)
    const countyBuckets = new Map<
      string,
      { labels: string[]; values: number[] }
    >()

    for (const row of cities) {
      const label = row.city.trim()
      if (!label) continue
      const value = valueByCity.get(label) ?? 0
      if (value <= 0) continue
      const point = overviewCityPointInBbox(label, bbox)
      const contained =
        counties.features.find((feat) =>
          geoContains(feat as Feature<Geometry>, point)
        ) ?? null
      const matched =
        contained ?? nearestCountyFeature(point, counties.features)
      if (!matched) continue
      const countyId = String(matched.id ?? label)
      const bucket = countyBuckets.get(countyId)
      if (bucket) {
        bucket.labels.push(label)
        bucket.values.push(value)
      } else {
        countyBuckets.set(countyId, {
          labels: [label],
          values: [value],
        })
      }
    }

    const regions: MapRegion[] = []
    for (const feat of counties.features) {
      const d = path(feat as Feature<Geometry>)
      if (!d) continue
      const countyId = String(feat.id ?? "")
      const bucket = countyBuckets.get(countyId)
      if (!bucket) {
        regions.push({
          key: countyId,
          label: "",
          value: 0,
          tier: null,
          pathD: d,
        })
        continue
      }

      const value = aggregateRegionValues(bucket.values, metricId)
      const topLabel =
        bucket.labels[bucket.values.indexOf(Math.max(...bucket.values))] ??
        bucket.labels[0] ??
        ""

      regions.push({
        key: countyId,
        label: topLabel,
        value,
        tier:
          value > 0 ? overviewMapBubbleTierForValue(value, thresholds) : null,
        pathD: d,
      })
    }

    return regions
  }, [
    cities,
    counties,
    metricId,
    path,
    selectedFeature,
    selectedState,
    thresholds,
    valueByCity,
  ])

  const regions = selectedState ? cityRegions : stateRegions
  const hasMetricRegions = regions.some((region) => region.tier !== null)
  const selectedStateOutline = selectedFeature
    ? path(selectedFeature as Feature<Geometry>)
    : null

  function wasPanned(): boolean {
    return Boolean(panRef.current?.moved)
  }

  function drillIntoState(stateName: string) {
    if (wasPanned() || selectedState) return
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
    // Keep moved flag until after the click event so handlers can ignore drags.
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

  const hoveredRegion = hovered
    ? (regions.find((region) => region.key === hovered) ?? null)
    : null
  const canZoomIn = transform.k < MAX_ZOOM - 0.001
  const canZoomOut = transform.k > MIN_ZOOM + 0.001
  const canReset = transform.k !== 1 || transform.x !== 0 || transform.y !== 0
  const boundaryWidth = selectedState ? 1.15 : 1.35

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
              {regions.map((region) => {
                const isHovered = hovered === region.key
                const fill =
                  region.tier === null
                    ? EMPTY_FILL
                    : OVERVIEW_MAP_TIER_COLORS[region.tier]
                const stroke = isHovered
                  ? OVERVIEW_MAP_TIER_STROKES[
                      (region.tier ?? 3) as OverviewMapBubbleTier
                    ]
                  : selectedState
                    ? COUNTY_BOUNDARY_STROKE
                    : BOUNDARY_STROKE
                return (
                  <g key={region.key}>
                    <path
                      d={region.pathD}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={isHovered ? 2 : boundaryWidth}
                      vectorEffect="non-scaling-stroke"
                      className="cursor-pointer"
                      onMouseEnter={() => {
                        if (!wasPanned() && (region.label || !selectedState)) {
                          setHovered(region.key)
                        }
                      }}
                      onMouseLeave={() => setHovered(null)}
                      onClick={(event) => {
                        if (selectedState) return
                        event.stopPropagation()
                        drillIntoState(region.label)
                      }}
                    >
                      {region.label ? (
                        <title>
                          {region.label}:{" "}
                          {formatMetricValue(region.value, metricId)}
                          {valueSuffix &&
                          metricId !== "fsr" &&
                          metricId !== "bounce-rate"
                            ? valueSuffix
                            : ""}
                        </title>
                      ) : null}
                    </path>
                  </g>
                )
              })}
            </g>

            {selectedStateOutline ? (
              <path
                d={selectedStateOutline}
                fill="none"
                stroke={BOUNDARY_STROKE}
                strokeWidth={2.25}
                vectorEffect="non-scaling-stroke"
                className="pointer-events-none"
              />
            ) : null}
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

      {!citiesLoading && selectedState && (citiesError || !hasMetricRegions) ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <p className="max-w-sm text-center text-sm text-neutral-500">
            {citiesError
              ? "Could not load city data for this state."
              : `No city location data for ${selectedState} in this range yet.`}
          </p>
        </div>
      ) : null}

      {!selectedState && !hasMetricRegions ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <p className="max-w-sm text-center text-sm text-neutral-500">
            No US state location data for this range yet. Regions fill once
            GeoIP state is present on events.
          </p>
        </div>
      ) : null}

      {hoveredRegion && hoveredRegion.label ? (
        <div
          className={cn(
            "pointer-events-none absolute top-3 left-3 rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-xs shadow-sm",
            selectedState && "mt-12"
          )}
        >
          <p className="font-semibold text-neutral-900">
            {hoveredRegion.label}
          </p>
          <p className="mt-0.5 text-neutral-600">
            {metricLabel}: {formatMetricValue(hoveredRegion.value, metricId)}
          </p>
          {!selectedState ? (
            <p className="mt-1 text-[10px] text-neutral-400">Click to expand</p>
          ) : null}
        </div>
      ) : null}

      <div className="absolute right-3 bottom-3 w-48 rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-[11px] shadow-sm">
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
              title={
                tier === 0
                  ? `≤ ${legendLabels[1] ?? minLabel}`
                  : tier === 8
                    ? (legendLabels[8] ?? maxLabel)
                    : `${legendLabels[tier]} – ${String(legendLabels[tier + 1] ?? "").replace(/\+$/, "")}`
              }
            />
          ))}
        </div>
        <div className="relative mt-1 h-3.5">
          {legendLabels.map((label, index) => {
            // Show endpoints + every other cut to keep the bar readable.
            const isEndpoint = index === 0 || index === legendLabels.length - 1
            const isMidTick = index % 2 === 0
            if (!isEndpoint && !isMidTick) return null
            const left = (index / (legendLabels.length - 1)) * 100
            return (
              <span
                key={`${label}-${index}`}
                className={cn(
                  "absolute top-0 text-[9px] leading-none text-neutral-500",
                  index === 0
                    ? "translate-x-0"
                    : index === legendLabels.length - 1
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
  )
}
