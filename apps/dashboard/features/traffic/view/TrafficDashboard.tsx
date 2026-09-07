"use client"

import { useCallback, useEffect, useState } from "react"
import { getTrafficEmptyDashboardData } from "@/features/traffic/controller/traffic-empty-data"
import { TrafficDashboardSkeleton } from "@/features/dashboard/view/dashboard-skeletons"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import type {
  TrafficDashboardData,
  TrafficKpiMetricId,
} from "@/features/traffic/model/traffic"
import { TRAFFIC_KPI_METRIC_ORDER } from "@/features/traffic/model/traffic-kpis"
import { TrafficDataTableCard } from "@/features/traffic/view/TrafficDataTableCard"
import { TrafficKpiRow } from "@/features/traffic/view/TrafficKpiRow"
import { TrafficSourcesCard } from "@/features/traffic/view/TrafficSourcesCard"
import { TRAFFIC_PREVIEW_ROW_LIMIT } from "@/features/traffic/view/traffic-card-layout"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import { useDashboardPreference } from "@/hooks/use-dashboard-preference"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"
import { useDashboardSegmentFilter } from "@/hooks/use-dashboard-segment-filter"
import type { AnalyticsFetchMode } from "@/lib/dashboard/analytics-fetch-mode"
import {
  buildAnalyticsApiPath,
  shouldUseInitialTabData,
} from "@/lib/dashboard/analytics-query"
import { dashboardGridTwoColClassName } from "@/features/overview/view/overview-card-density"
import { cn } from "@workspace/ui/lib/utils"

const TRAFFIC_REFETCH_MS = 60_000

type TrafficDashboardProps = {
  data: TrafficDashboardData
  projectId: string
  isActive?: boolean
  isLoading?: boolean
  allowedSections?: string[] | null
}

export function TrafficDashboard({
  data: initialData,
  projectId,
  isActive = true,
  isLoading: isTabLoading = false,
  allowedSections = null,
}: TrafficDashboardProps) {
  const showSection = (id: string) =>
    !allowedSections || allowedSections.includes(id)
  const { dateRangeId, customRange, setDateRangeId, setCustomRange } =
    useDashboardDateRange()
  const { utmFilter } = useDashboardUtmFilter()
  const { segmentId } = useDashboardSegmentFilter()
  const [activeKpiId, setActiveKpiId] = useDashboardPreference(
    projectId,
    "kpi:traffic",
    (raw) =>
      raw && (TRAFFIC_KPI_METRIC_ORDER as readonly string[]).includes(raw)
        ? (raw as TrafficKpiMetricId)
        : initialData.defaultKpiMetricId
  )
  const [dashboardData, setDashboardData] = useState(initialData)
  const [isBlockingLoad, setIsBlockingLoad] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchTrafficForRange = useCallback(
    async (
      rangeId: typeof dateRangeId,
      signal?: AbortSignal,
      mode: AnalyticsFetchMode = "blocking"
    ) => {
      if (mode === "blocking") setIsBlockingLoad(true)
      else setIsRefreshing(true)

      const url = buildAnalyticsApiPath(
        `/api/landing-pages/${encodeURIComponent(projectId)}/traffic`,
        { rangeId, customRange, utmFilter, segmentId }
      )
      try {
        const res = await fetch(url, { cache: "no-store", signal })
        if (!res.ok) {
          if (process.env.NODE_ENV === "development") {
            const body = await res.text().catch(() => "")
            console.error(
              `[traffic] client fetch ${res.status}`,
              body.slice(0, 200)
            )
          }
          if (mode === "blocking") {
            setDashboardData((prev) =>
              getTrafficEmptyDashboardData(projectId, rangeId, prev.formType)
            )
          }
          return
        }
        const next = (await res.json()) as TrafficDashboardData
        setDashboardData(next)
      } catch (err) {
        if (signal?.aborted) return
        if (process.env.NODE_ENV === "development") {
          console.error("[traffic] client fetch failed", err)
        }
        if (mode === "blocking") {
          setDashboardData((prev) =>
            getTrafficEmptyDashboardData(projectId, rangeId, prev.formType)
          )
        }
      } finally {
        if (!signal?.aborted) {
          if (mode === "blocking") setIsBlockingLoad(false)
          else setIsRefreshing(false)
        }
      }
    },
    [projectId, customRange, utmFilter, segmentId, dashboardData.formType]
  )

  useEffect(() => {
    if (
      shouldUseInitialTabData(
        dateRangeId,
        initialData.defaultDateRangeId,
        utmFilter,
        customRange,
        undefined,
        segmentId
      )
    ) {
      setDashboardData(initialData)
      setIsBlockingLoad(false)
      return
    }

    const controller = new AbortController()
    void fetchTrafficForRange(dateRangeId, controller.signal, "background")
    return () => controller.abort()
  }, [
    customRange,
    dateRangeId,
    utmFilter,
    segmentId,
    initialData,
    fetchTrafficForRange,
  ])

  useEffect(() => {
    if (!isActive) return

    const controller = new AbortController()
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      void fetchTrafficForRange(dateRangeId, controller.signal, "background")
    }, TRAFFIC_REFETCH_MS)

    return () => {
      controller.abort()
      window.clearInterval(id)
    }
  }, [
    customRange,
    dateRangeId,
    utmFilter,
    segmentId,
    fetchTrafficForRange,
    isActive,
  ])

  return (
    <div className="flex flex-col gap-4 pb-6">
      <OverviewHeader
        title="Traffic"
        projectId={projectId}
        dateRangeOptions={dashboardData.dateRangeOptions}
        dateRangeId={dateRangeId}
        customRange={customRange}
        onDateRangeChange={setDateRangeId}
        onCustomRangeChange={setCustomRange}
      />

      {isTabLoading || isBlockingLoad ? (
        <TrafficDashboardSkeleton />
      ) : (
        <div
          className={cn(
            "flex flex-col gap-4 transition-opacity",
            isRefreshing && "opacity-80"
          )}
          aria-busy={isRefreshing}
        >
          <TrafficKpiRow
            kpis={dashboardData.kpis}
            activeKpiId={activeKpiId}
            onKpiSelect={setActiveKpiId}
          />

          <div className="flex flex-col gap-4">
            <div className={dashboardGridTwoColClassName}>
              {showSection("time") ? (
                <TrafficDataTableCard
                  section={dashboardData.trafficByTime}
                  expandable
                  previewRowLimit={TRAFFIC_PREVIEW_ROW_LIMIT}
                />
              ) : null}
              {showSection("location") ? (
                <TrafficDataTableCard
                  section={dashboardData.trafficByLocation}
                  expandable
                  previewRowLimit={TRAFFIC_PREVIEW_ROW_LIMIT}
                />
              ) : null}
            </div>

            <div className={dashboardGridTwoColClassName}>
              {showSection("device") ? (
                <TrafficDataTableCard
                  section={dashboardData.trafficByDevice}
                  expandable
                  previewRowLimit={TRAFFIC_PREVIEW_ROW_LIMIT}
                />
              ) : null}
              {showSection("sources") ? (
                <TrafficSourcesCard
                  referrers={dashboardData.referrers}
                  utmByParam={dashboardData.utmByParam}
                  expandable
                  previewRowLimit={TRAFFIC_PREVIEW_ROW_LIMIT}
                  projectId={projectId}
                />
              ) : null}
            </div>

            {showSection("pages") ? (
              <div className={dashboardGridTwoColClassName}>
                <div className="lg:col-span-2">
                  <TrafficDataTableCard
                    section={dashboardData.topPages}
                    expandable
                    previewRowLimit={TRAFFIC_PREVIEW_ROW_LIMIT}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
