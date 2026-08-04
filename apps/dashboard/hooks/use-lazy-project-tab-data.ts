"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { AlertsDashboardData } from "@/features/alerts/model/alerts"
import { getAlertsEmptyDashboardData } from "@/features/alerts/controller/alerts-empty-data"
import type { EventTrackingDashboardData } from "@/features/event-tracking/model/event-tracking"
import { getEventTrackingEmptyDashboardData } from "@/features/event-tracking/controller/event-tracking-empty-data"
import type { ExperimentsDashboardData } from "@/features/experiments/model/experiments"
import { getExperimentsEmptyDashboardData } from "@/features/experiments/controller/experiments-empty-data"
import type { FunnelDashboardData } from "@/features/funnel/model/funnel"
import { getFunnelEmptyDashboardData } from "@/features/funnel/controller/funnel-empty-data"
import type { HeatmapDashboardData } from "@/features/heatmap/model/heatmap"
import { getHeatmapEmptyDashboardData } from "@/features/heatmap/controller/heatmap-empty-data"
import type {
  OverviewDashboardData,
  OverviewDateRangeId,
  OverviewLandingFormType,
} from "@/features/overview/model/overview"
import type { SegmentsDashboardData } from "@/features/segments/model/segments"
import { getSegmentsEmptyDashboardData } from "@/features/segments/controller/segments-empty-data"
import type { SeoDashboardData } from "@/features/seo/model/seo"
import { getSeoEmptyDashboardData } from "@/features/seo/controller/seo-empty-data"
import type { UtmDashboardData } from "@/features/utm/model/utm"
import { getUtmEmptyDashboardData } from "@/features/utm/controller/utm-empty-data"
import type { LandingPageSettingsData } from "@/features/settings/model/landing-page-settings"
import type { TrafficDashboardData } from "@/features/traffic/model/traffic"
import type { DashboardCustomRange } from "@/features/traffic/model/traffic-range"
import { getTrafficEmptyDashboardData } from "@/features/traffic/controller/traffic-empty-data"
import type { ProjectTabValue } from "@/features/dashboard/model/project-tab"
import type { DashboardUtmFilter } from "@/features/dashboard/model/utm-attribution-filter"
import { utmFilterCacheKey } from "@/features/dashboard/model/utm-attribution-filter"
import { buildAnalyticsApiPath } from "@/lib/dashboard/analytics-query"

export type ProjectTabData = {
  overview: OverviewDashboardData
  traffic: TrafficDashboardData
  funnel: FunnelDashboardData
  heatmap: HeatmapDashboardData
  "event-tracking": EventTrackingDashboardData
  segments: SegmentsDashboardData
  experiments: ExperimentsDashboardData
  seo: SeoDashboardData
  utm: UtmDashboardData
  alerts: AlertsDashboardData
  settings: LandingPageSettingsData
}

type InitialTabData = Partial<ProjectTabData>

function tabApiPath(
  projectId: string,
  tab: ProjectTabValue,
  rangeId: OverviewDateRangeId,
  utmFilter?: DashboardUtmFilter,
  customRange?: DashboardCustomRange,
  segmentId?: string | null
): string {
  const base = `/api/landing-pages/${encodeURIComponent(projectId)}`
  if (tab === "settings") return `${base}/settings`
  if (tab === "utm") return `${base}/utm`

  const path = tab === "event-tracking" ? `${base}/events` : `${base}/${tab}`

  return buildAnalyticsApiPath(path, {
    rangeId,
    customRange,
    utmFilter,
    segmentId,
  })
}

function emptyTabData(
  tab: Exclude<ProjectTabValue, "overview" | "settings">,
  projectId: string,
  rangeId: OverviewDateRangeId,
  formType: OverviewLandingFormType
): ProjectTabData[typeof tab] {
  switch (tab) {
    case "traffic":
      return getTrafficEmptyDashboardData(projectId, rangeId, formType)
    case "funnel":
      return getFunnelEmptyDashboardData(projectId, rangeId, formType)
    case "heatmap":
      return getHeatmapEmptyDashboardData(projectId, rangeId)
    case "event-tracking":
      return getEventTrackingEmptyDashboardData(projectId, rangeId, formType)
    case "segments":
      return getSegmentsEmptyDashboardData(projectId, rangeId, formType)
    case "experiments":
      return getExperimentsEmptyDashboardData(projectId, rangeId, formType)
    case "seo":
      return getSeoEmptyDashboardData(projectId, rangeId)
    case "utm":
      return getUtmEmptyDashboardData(projectId)
    case "alerts":
      return getAlertsEmptyDashboardData(projectId, rangeId)
  }
}

function seedSettledEpochs(
  initial: InitialTabData
): Partial<Record<ProjectTabValue, number>> {
  const seeded: Partial<Record<ProjectTabValue, number>> = {}
  for (const tab of Object.keys(initial) as ProjectTabValue[]) {
    if (initial[tab]) seeded[tab] = 0
  }
  return seeded
}

export function useLazyProjectTabData({
  projectId,
  activeTab,
  rangeId,
  customRange,
  utmFilter,
  segmentId,
  formType,
  overviewPlaceholder,
  initial,
}: {
  projectId: string
  activeTab: ProjectTabValue
  rangeId: OverviewDateRangeId
  customRange?: DashboardCustomRange
  utmFilter?: DashboardUtmFilter
  segmentId?: string | null
  formType: OverviewLandingFormType
  overviewPlaceholder: OverviewDashboardData
  initial: InitialTabData
}) {
  const [cache, setCache] = useState<InitialTabData>(() => ({ ...initial }))
  const [loadingTab, setLoadingTab] = useState<ProjectTabValue | null>(null)
  const inFlightRef = useRef<ProjectTabValue | null>(null)
  const utmCacheKey = utmFilterCacheKey(utmFilter)
  const customRangeCacheKey = customRange
    ? `${customRange.from}:${customRange.to}`
    : "none"
  const segmentCacheKey = segmentId ?? "none"
  const filterKeyRef = useRef({
    rangeId,
    utmCacheKey,
    customRangeCacheKey,
    segmentCacheKey,
  })
  const [filterEpoch, setFilterEpoch] = useState(0)
  const settledEpochRef = useRef<Partial<Record<ProjectTabValue, number>>>(
    seedSettledEpochs(initial)
  )
  const cacheRef = useRef(cache)
  cacheRef.current = cache

  const fetchTab = useCallback(
    async (tab: ProjectTabValue, signal?: AbortSignal) => {
      const res = await fetch(
        tabApiPath(projectId, tab, rangeId, utmFilter, customRange, segmentId),
        {
          cache: "no-store",
          signal,
        }
      )
      if (!res.ok) {
        throw new Error(`Failed to load ${tab}: ${res.status}`)
      }
      return (await res.json()) as ProjectTabData[typeof tab]
    },
    [projectId, rangeId, customRange, utmFilter, segmentId]
  )

  const fetchTabRef = useRef(fetchTab)
  fetchTabRef.current = fetchTab

  const emptyDataArgsRef = useRef({ rangeId, formType })
  emptyDataArgsRef.current = { rangeId, formType }

  useEffect(() => {
    const prev = filterKeyRef.current
    if (
      prev.rangeId === rangeId &&
      prev.utmCacheKey === utmCacheKey &&
      prev.customRangeCacheKey === customRangeCacheKey &&
      prev.segmentCacheKey === segmentCacheKey
    ) {
      return
    }
    filterKeyRef.current = {
      rangeId,
      utmCacheKey,
      customRangeCacheKey,
      segmentCacheKey,
    }
    inFlightRef.current = null
    settledEpochRef.current = {}
    setFilterEpoch((value) => value + 1)
  }, [rangeId, utmCacheKey, customRangeCacheKey, segmentCacheKey])

  useEffect(() => {
    if (settledEpochRef.current[activeTab] === filterEpoch) return
    if (inFlightRef.current === activeTab) return

    const hasCached = Boolean(cacheRef.current[activeTab])
    inFlightRef.current = activeTab
    const controller = new AbortController()
    queueMicrotask(() => {
      if (!controller.signal.aborted && !hasCached) {
        setLoadingTab(activeTab)
      }
    })

    void fetchTabRef
      .current(activeTab, controller.signal)
      .then((data) => {
        setCache((prev) => ({ ...prev, [activeTab]: data }))
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        console.error(`[project-tab] ${activeTab} fetch failed`, err)
        if (hasCached) return
        if (activeTab === "overview" || activeTab === "settings") return
        const { rangeId: r, formType: f } = emptyDataArgsRef.current
        setCache((prev) => ({
          ...prev,
          [activeTab]: emptyTabData(activeTab, projectId, r, f),
        }))
      })
      .finally(() => {
        if (controller.signal.aborted) return
        settledEpochRef.current[activeTab] = filterEpoch
        inFlightRef.current = null
        setLoadingTab((current) => (current === activeTab ? null : current))
      })

    return () => {
      controller.abort()
      if (inFlightRef.current === activeTab) {
        inFlightRef.current = null
      }
    }
  }, [activeTab, filterEpoch, projectId])

  return {
    overview: (cache.overview ?? overviewPlaceholder) as OverviewDashboardData,
    traffic:
      cache.traffic ??
      getTrafficEmptyDashboardData(projectId, rangeId, formType),
    funnel:
      cache.funnel ?? getFunnelEmptyDashboardData(projectId, rangeId, formType),
    heatmap: cache.heatmap ?? getHeatmapEmptyDashboardData(projectId, rangeId),
    eventTracking:
      cache["event-tracking"] ??
      getEventTrackingEmptyDashboardData(projectId, rangeId, formType),
    segments:
      cache.segments ??
      getSegmentsEmptyDashboardData(projectId, rangeId, formType),
    experiments:
      cache.experiments ??
      getExperimentsEmptyDashboardData(projectId, rangeId, formType),
    seo: cache.seo ?? getSeoEmptyDashboardData(projectId, rangeId),
    utm: cache.utm ?? getUtmEmptyDashboardData(projectId),
    alerts: cache.alerts ?? getAlertsEmptyDashboardData(projectId, rangeId),
    settings: cache.settings ?? null,
    loadingTab,
  }
}
