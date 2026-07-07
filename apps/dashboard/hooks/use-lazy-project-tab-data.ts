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
import type {
  OverviewDashboardData,
  OverviewDateRangeId,
  OverviewLandingFormType,
} from "@/features/overview/model/overview"
import type { SegmentsDashboardData } from "@/features/segments/model/segments"
import { getSegmentsEmptyDashboardData } from "@/features/segments/controller/segments-empty-data"
import type { SeoDashboardData } from "@/features/seo/model/seo"
import { getSeoEmptyDashboardData } from "@/features/seo/controller/seo-empty-data"
import type { LandingPageSettingsData } from "@/features/settings/model/landing-page-settings"
import type { TrafficDashboardData } from "@/features/traffic/model/traffic"
import { getTrafficEmptyDashboardData } from "@/features/traffic/controller/traffic-empty-data"
import type { ProjectTabValue } from "@/features/dashboard/model/project-tab"

export type ProjectTabData = {
  overview: OverviewDashboardData
  traffic: TrafficDashboardData
  funnel: FunnelDashboardData
  "event-tracking": EventTrackingDashboardData
  segments: SegmentsDashboardData
  experiments: ExperimentsDashboardData
  seo: SeoDashboardData
  alerts: AlertsDashboardData
  settings: LandingPageSettingsData
}

type InitialTabData = Partial<ProjectTabData>

function tabApiPath(
  projectId: string,
  tab: ProjectTabValue,
  rangeId: OverviewDateRangeId
): string {
  const base = `/api/landing-pages/${encodeURIComponent(projectId)}`
  if (tab === "settings") return `${base}/settings`

  const qs = `?range_id=${encodeURIComponent(rangeId)}`
  if (tab === "event-tracking") return `${base}/events${qs}`
  return `${base}/${tab}${qs}`
}

function emptyTabData(
  tab: Exclude<ProjectTabValue, "overview" | "settings">,
  projectId: string,
  rangeId: OverviewDateRangeId,
  formType: OverviewLandingFormType
): ProjectTabData[typeof tab] {
  switch (tab) {
    case "traffic":
      return getTrafficEmptyDashboardData(projectId, rangeId)
    case "funnel":
      return getFunnelEmptyDashboardData(projectId, rangeId, formType)
    case "event-tracking":
      return getEventTrackingEmptyDashboardData(projectId, rangeId, formType)
    case "segments":
      return getSegmentsEmptyDashboardData(projectId, rangeId)
    case "experiments":
      return getExperimentsEmptyDashboardData(projectId, rangeId, formType)
    case "seo":
      return getSeoEmptyDashboardData(projectId, rangeId)
    case "alerts":
      return getAlertsEmptyDashboardData(projectId, rangeId)
  }
}

export function useLazyProjectTabData({
  projectId,
  activeTab,
  rangeId,
  formType,
  overviewPlaceholder,
  initial,
}: {
  projectId: string
  activeTab: ProjectTabValue
  rangeId: OverviewDateRangeId
  formType: OverviewLandingFormType
  overviewPlaceholder: OverviewDashboardData
  initial: InitialTabData
}) {
  const [cache, setCache] = useState<InitialTabData>(() => ({ ...initial }))
  const [loadingTab, setLoadingTab] = useState<ProjectTabValue | null>(null)
  const inFlightRef = useRef<ProjectTabValue | null>(null)

  const fetchTab = useCallback(
    async (tab: ProjectTabValue, signal?: AbortSignal) => {
      const res = await fetch(tabApiPath(projectId, tab, rangeId), {
        cache: "no-store",
        signal,
      })
      if (!res.ok) {
        throw new Error(`Failed to load ${tab}: ${res.status}`)
      }
      return (await res.json()) as ProjectTabData[typeof tab]
    },
    [projectId, rangeId]
  )

  useEffect(() => {
    if (cache[activeTab] || inFlightRef.current === activeTab) return

    inFlightRef.current = activeTab
    const controller = new AbortController()
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setLoadingTab(activeTab)
      }
    })

    void fetchTab(activeTab, controller.signal)
      .then((data) => {
        setCache((prev) => ({ ...prev, [activeTab]: data }))
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        if (process.env.NODE_ENV === "development") {
          console.error(`[project-tab] ${activeTab} fetch failed`, err)
        }
        if (activeTab !== "overview" && activeTab !== "settings") {
          setCache((prev) => ({
            ...prev,
            [activeTab]: emptyTabData(activeTab, projectId, rangeId, formType),
          }))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          inFlightRef.current = null
          setLoadingTab((current) => (current === activeTab ? null : current))
        }
      })

    return () => {
      controller.abort()
      if (inFlightRef.current === activeTab) {
        inFlightRef.current = null
      }
    }
  }, [activeTab, cache, fetchTab, formType, projectId, rangeId])

  return {
    overview: (cache.overview ?? overviewPlaceholder) as OverviewDashboardData,
    traffic: cache.traffic ?? getTrafficEmptyDashboardData(projectId, rangeId),
    funnel:
      cache.funnel ?? getFunnelEmptyDashboardData(projectId, rangeId, formType),
    eventTracking:
      cache["event-tracking"] ??
      getEventTrackingEmptyDashboardData(projectId, rangeId, formType),
    segments:
      cache.segments ?? getSegmentsEmptyDashboardData(projectId, rangeId),
    experiments:
      cache.experiments ??
      getExperimentsEmptyDashboardData(projectId, rangeId, formType),
    seo: cache.seo ?? getSeoEmptyDashboardData(projectId, rangeId),
    alerts: cache.alerts ?? getAlertsEmptyDashboardData(projectId, rangeId),
    settings: cache.settings ?? null,
    loadingTab,
  }
}
