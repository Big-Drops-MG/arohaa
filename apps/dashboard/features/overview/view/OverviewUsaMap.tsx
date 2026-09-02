"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { geoAlbers, geoAlbersUsa, geoPath } from "d3-geo"
import type { Feature, FeatureCollection, Geometry } from "geojson"
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
  US_COUNTIES_GEOJSON_URL,
  US_STATE_FIPS_TO_NAME,
  US_STATE_NAME_TO_FIPS,
  US_STATES_GEOJSON_URL,
  normalizeUsStateName,
  overviewMapBubbleTier,
  overviewMapBubbleTierForValue,
  type OverviewMapBubbleTier,
  type OverviewMapDrillLevel,
} from "@/features/overview/model/us-states"
import {
  buildCountyRegions,
  countyRegionHoverSummary,
  type OverviewMapRegion,
} from "@/features/overview/utils/overview-map-drill"
import { buildAnalyticsApiPath } from "@/lib/dashboard/analytics-query"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"
import { useDashboardSegmentFilter } from "@/hooks/use-dashboard-segment-filter"
import type { DashboardCustomRange } from "@/features/traffic/model/traffic-range"

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

type MapTransform = {
  k: number
  x: number
  y: number
}

function drillLevel(selectedState: string | null): OverviewMapDrillLevel {
  return selectedState ? "state" : "usa"
}

function legendScopeLabel(level: OverviewMapDrillLevel): string {
  return level === "state" ? " · Cities" : ""
}

function normalizeStateFips(value: string): string {
  return value.padStart(2, "0")
}

function featureStateFips(feat: Feature): string {
  const props = feat.properties as Record<string, unknown> | null | undefined
  const raw = String(feat.id ?? props?.GEOID ?? props?.STATEFP ?? "")
  return normalizeStateFips(raw.slice(0, 2))
}

const MAP_WIDTH = 720
const MAP_HEIGHT = 420
const MIN_ZOOM = 1
const MAX_ZOOM = 12
const ZOOM_STEP = 1.4
const PAN_THRESHOLD_PX = 6
const EMPTY_FILL = "#f8fafc"
const BOUNDARY_STROKE = "#334155"
const INNER_BOUNDARY_STROKE = "#64748b"
const IDENTITY_TRANSFORM: MapTransform = { k: 1, x: 0, y: 0 }
const MAX_HOVER_CITIES = 8

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
  return {
    x: ((clientX - rect.left) / rect.width) * MAP_WIDTH,
    y: ((clientY - rect.top) / rect.height) * MAP_HEIGHT,
  }
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
  const [countiesLoading, setCountiesLoading] = useState(false)
  const [countiesError, setCountiesError] = useState(false)
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

  const level = drillLevel(selectedState)

  useEffect(() => {
    transformRef.current = transform
  }, [transform])

  useEffect(() => {
    let cancelled = false
    void fetch(US_STATES_GEOJSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`states geojson ${res.status}`)
        return res.json() as Promise<FeatureCollection>
      })
      .then((geojson) => {
        if (cancelled) return
        setCollection(geojson)
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
      setCountiesLoading(false)
      setCountiesError(false)
      return
    }
    const stateFips = US_STATE_NAME_TO_FIPS[selectedState]
    if (!stateFips) {
      setCounties(null)
      setCountiesLoading(false)
      setCountiesError(true)
      return
    }

    let cancelled = false
    setCountiesLoading(true)
    setCountiesError(false)
    void fetch(US_COUNTIES_GEOJSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`counties geojson ${res.status}`)
        return res.json() as Promise<FeatureCollection>
      })
      .then((geojson) => {
        if (cancelled) return
        const padded = normalizeStateFips(stateFips)
        setCounties({
          type: "FeatureCollection",
          features: geojson.features.filter(
            (feat) => featureStateFips(feat) === padded
          ),
        })
      })
      .catch(() => {
        if (!cancelled) {
          setCounties(null)
          setCountiesError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setCountiesLoading(false)
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
        segmentId,
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

  const selectedStateFeature = useMemo(() => {
    if (!collection || !selectedState) return null
    const fips = US_STATE_NAME_TO_FIPS[selectedState]
    if (!fips) return null
    const padded = normalizeStateFips(fips)
    return (
      collection.features.find((feat) => featureStateFips(feat) === padded) ??
      null
    )
  }, [collection, selectedState])

  const focusFeature = useMemo((): Feature | FeatureCollection | null => {
    if (level === "state") {
      return selectedStateFeature
    }
    return collection
  }, [collection, level, selectedStateFeature])

  const { thresholds, legendLabels } = useMemo(
    () => overviewMapBubbleTier(metricId),
    [metricId]
  )

  const projection = useMemo(() => {
    const padding = level === "usa" ? 0 : 28
    const extent: [[number, number], [number, number]] =
      level === "usa"
        ? [
            [0, 0],
            [MAP_WIDTH, MAP_HEIGHT],
          ]
        : [
            [padding, padding],
            [MAP_WIDTH - padding, MAP_HEIGHT - padding],
          ]

    if (level === "usa") {
      const proj = geoAlbersUsa()
      if (!collection || collection.features.length === 0) {
        return proj.translate([MAP_WIDTH / 2, MAP_HEIGHT / 2]).scale(900)
      }
      return proj.fitSize([MAP_WIDTH, MAP_HEIGHT], collection)
    }

    if (!focusFeature) {
      return geoAlbers()
        .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2])
        .scale(900)
    }

    return geoAlbers().fitExtent(extent, focusFeature as Feature<Geometry>)
  }, [collection, focusFeature, level])

  const path = useMemo(() => geoPath(projection), [projection])

  const stateRegions = useMemo((): OverviewMapRegion[] => {
    if (!collection || level !== "usa") return []
    return collection.features.flatMap((feat) => {
      const fips = featureStateFips(feat)
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
  }, [collection, level, path, thresholds, valueByState])

  const countyRegions = useMemo((): OverviewMapRegion[] => {
    if (level !== "state" || !counties) return []
    return buildCountyRegions({
      counties,
      cities,
      metricId,
      thresholds,
      path,
    })
  }, [cities, counties, level, metricId, path, thresholds])

  const regions = level === "usa" ? stateRegions : countyRegions

  const hasMetricRegions =
    level === "usa"
      ? regions.some((region) => region.tier !== null)
      : regions.some(
          (region) =>
            region.tier !== null || (region.cityEntries?.length ?? 0) > 0
        )
  const outlineFeature = level === "state" ? selectedStateFeature : null
  const outlinePath = outlineFeature
    ? path(outlineFeature as Feature<Geometry>)
    : null

  function wasPanned(): boolean {
    return Boolean(panRef.current?.moved)
  }

  function drillIntoState(stateName: string) {
    if (wasPanned() || level !== "usa") return
    const normalized = normalizeUsStateName(stateName)
    if (!normalized) return
    setHovered(null)
    setSelectedState(normalized)
  }

  function backToUsa() {
    setHovered(null)
    setSelectedState(null)
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

  function handleRegionClick(region: OverviewMapRegion) {
    if (level === "usa") {
      drillIntoState(region.label)
    }
  }

  function canDrillFromLevel(): boolean {
    return level === "usa"
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
  const showCountyCityBreakdown =
    level === "state" &&
    Boolean(hoveredRegion?.cityEntries && hoveredRegion.cityEntries.length > 0)
  const canZoomIn = transform.k < MAX_ZOOM - 0.001
  const canZoomOut = transform.k > MIN_ZOOM + 0.001
  const canReset = transform.k !== 1 || transform.x !== 0 || transform.y !== 0
  const boundaryWidth = level === "usa" ? 1.35 : 1.15
  const formatValue = (value: number): string => {
    const base = formatMetricValue(value, metricId)
    if (metricId === "fsr" || metricId === "bounce-rate") return base
    return valueSuffix ? `${base}${valueSuffix}` : base
  }
  const selectedStateMetricValue = selectedState
    ? (valueByState.get(selectedState) ?? 0)
    : 0
  const isLoading = level === "state" && (citiesLoading || countiesLoading)
  const showEmptyOverlay =
    !isLoading &&
    ((level === "usa" && !hasMetricRegions) ||
      (level === "state" &&
        (citiesError || countiesError || !hasMetricRegions)))

  const emptyMessage =
    level === "usa"
      ? "No US state location data for this range yet. Regions fill once GeoIP state is present on events."
      : countiesError
        ? `Could not load county boundaries for ${selectedState}.`
        : citiesError
          ? `Could not load city data for ${selectedState}.`
          : selectedStateMetricValue > 0 && cities.length === 0
            ? `${selectedState} has ${formatMetricValue(selectedStateMetricValue, metricId)} at the state level, but events in this range are missing city or ZIP location data needed for county drill-down.`
            : `No county-level data for ${selectedState} in this range yet.`

  return (
    <div className={cn("relative h-full min-h-0 w-full", className)}>
      {level !== "usa" ? (
        <div className="absolute top-3 left-3 z-10 flex max-w-[min(100%,20rem)] flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={backToUsa}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-neutral-800 shadow-sm transition-colors hover:bg-neutral-50"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back
          </button>
          {selectedState ? (
            <span className="rounded-lg border border-neutral-200 bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm">
              {selectedState}
            </span>
          ) : null}
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
          aria-label={`${metricLabel} by US ${level === "usa" ? "state" : level}`}
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
                  : level === "usa"
                    ? BOUNDARY_STROKE
                    : INNER_BOUNDARY_STROKE
                return (
                  <path
                    key={region.key}
                    d={region.pathD}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isHovered ? 2 : boundaryWidth}
                    vectorEffect="non-scaling-stroke"
                    className={cn(canDrillFromLevel() && "cursor-pointer")}
                    onMouseEnter={() => {
                      if (!wasPanned() && region.label) {
                        setHovered(region.key)
                      }
                    }}
                    onMouseLeave={() => setHovered(null)}
                    onClick={(event) => {
                      event.stopPropagation()
                      handleRegionClick(region)
                    }}
                  >
                    {region.label ? (
                      <title>
                        {level === "state"
                          ? `${countyRegionHoverSummary(region, formatValue)}\n${metricLabel} total: ${formatValue(region.value)}`
                          : `${region.label}: ${formatValue(region.value)}`}
                      </title>
                    ) : null}
                  </path>
                )
              })}
            </g>

            {outlinePath ? (
              <path
                d={outlinePath}
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

      {isLoading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/40">
          <p className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600 shadow-sm">
            Loading map data…
          </p>
        </div>
      ) : null}

      {showEmptyOverlay ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <p className="max-w-sm text-center text-sm text-neutral-500">
            {emptyMessage}
          </p>
        </div>
      ) : null}

      {hoveredRegion ? (
        <div
          className={cn(
            "pointer-events-none absolute top-3 left-3 z-20 w-60 max-w-[calc(100%-1.5rem)] overflow-hidden rounded-lg border border-neutral-200 bg-white/97 shadow-md",
            level !== "usa" && "mt-12"
          )}
        >
          <div className="flex items-baseline justify-between gap-2 border-b border-neutral-100 px-3 py-2">
            <p className="truncate text-xs font-semibold text-neutral-900">
              {hoveredRegion.label}
              {level === "state" ? " County" : ""}
            </p>
            {level === "state" ? (
              <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 tabular-nums">
                {(hoveredRegion.totalZipCount ?? 0).toLocaleString("en-US")}{" "}
                {hoveredRegion.totalZipCount === 1 ? "zip" : "zips"}
              </span>
            ) : null}
          </div>

          {level === "state" ? (
            <div className="px-3 py-2">
              {showCountyCityBreakdown && hoveredRegion.cityEntries ? (
                <ul className="space-y-1">
                  {hoveredRegion.cityEntries
                    .slice(0, MAX_HOVER_CITIES)
                    .map((entry) => (
                      <li
                        key={entry.label}
                        className="flex items-baseline justify-between gap-3 text-[11px] leading-snug"
                      >
                        <span className="flex min-w-0 items-baseline gap-1.5">
                          <span className="text-neutral-300" aria-hidden>
                            •
                          </span>
                          <span className="truncate text-neutral-700">
                            {entry.label}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums">
                          <span className="font-medium text-neutral-900">
                            {formatValue(entry.value)}
                          </span>
                          <span className="ml-1.5 text-[10px] text-neutral-400">
                            {entry.zipCount.toLocaleString("en-US")}{" "}
                            {entry.zipCount === 1 ? "zip" : "zips"}
                          </span>
                        </span>
                      </li>
                    ))}
                  {hoveredRegion.cityEntries.length > MAX_HOVER_CITIES ? (
                    <li className="pt-0.5 pl-3 text-[10px] text-neutral-400">
                      +{hoveredRegion.cityEntries.length - MAX_HOVER_CITIES}{" "}
                      more cities
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="text-[11px] text-neutral-400">
                  No city data in this range
                </p>
              )}
            </div>
          ) : null}

          <div
            className={cn(
              "px-3 py-2",
              level === "state" && "border-t border-neutral-100"
            )}
          >
            <p className="flex items-baseline justify-between gap-3 text-[11px] text-neutral-600">
              <span className="truncate">{metricLabel}</span>
              <span className="shrink-0 font-medium text-neutral-900 tabular-nums">
                {formatMetricValue(hoveredRegion.value, metricId)}
                {valueSuffix && metricId !== "fsr" && metricId !== "bounce-rate"
                  ? valueSuffix
                  : ""}
              </span>
            </p>
            {canDrillFromLevel() ? (
              <p className="mt-1 text-[10px] text-neutral-400">
                Click to expand
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="absolute right-3 bottom-3 w-48 rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-[11px] shadow-sm">
        <p className="mb-1.5 font-semibold tracking-wide text-neutral-700 uppercase">
          {metricLabel}
          {legendScopeLabel(level)}
        </p>
        <div className="flex h-2.5 overflow-hidden rounded-sm border border-neutral-200/80">
          {OVERVIEW_MAP_TIER_IDS.map((tier) => (
            <span
              key={tier}
              className="h-full flex-1"
              style={{ backgroundColor: OVERVIEW_MAP_TIER_COLORS[tier] }}
              title={
                tier === 0
                  ? `≤ ${legendLabels[1] ?? "0"}`
                  : tier === 8
                    ? (legendLabels[8] ?? "0")
                    : `${legendLabels[tier]} – ${String(legendLabels[tier + 1] ?? "").replace(/\+$/, "")}`
              }
            />
          ))}
        </div>
        <div className="relative mt-1 h-3.5">
          {legendLabels.map((label, index) => {
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
