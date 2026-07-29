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
import type { AnalyticsFetchMode } from "@/lib/dashboard/analytics-fetch-mode"
import {
  buildAnalyticsApiPath,
  shouldUseInitialTabData,
} from "@/lib/dashboard/analytics-query"
import { cn } from "@workspace/ui/lib/utils"

const TRAFFIC_REFETCH_MS = 60_000

type TrafficDashboardProps = {
  data: TrafficDashboardData
  projectId: string
  isActive?: boolean
  isLoading?: boolean
}

export function TrafficDashboard({
  data: initialData,
  projectId,
  isActive = true,
  isLoading: isTabLoading = false,
}: TrafficDashboardProps) {
  const { dateRangeId, customRange, setDateRangeId, setCustomRange } =
    useDashboardDateRange()
  const { utmFilter } = useDashboardUtmFilter()
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
        { rangeId, customRange, utmFilter }
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
    [projectId, customRange, utmFilter]
  )

  useEffect(() => {
    if (
      shouldUseInitialTabData(
        dateRangeId,
        initialData.defaultDateRangeId,
        utmFilter,
        customRange
      )
    ) {
      setDashboardData(initialData)
      setIsBlockingLoad(false)
      return
    }

    const controller = new AbortController()
    void fetchTrafficForRange(dateRangeId, controller.signal, "background")
    return () => controller.abort()
  }, [customRange, dateRangeId, utmFilter, initialData, fetchTrafficForRange])

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
  }, [customRange, dateRangeId, utmFilter, fetchTrafficForRange, isActive])

  return (
    <div className="flex flex-col gap-4 px-6 pb-6 lg:px-8">
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
            <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch lg:[&>*]:min-h-0">
              <TrafficDataTableCard
                section={dashboardData.trafficByTime}
                expandable
                previewRowLimit={TRAFFIC_PREVIEW_ROW_LIMIT}
              />
              <TrafficDataTableCard
                section={dashboardData.trafficByLocation}
                expandable
                previewRowLimit={TRAFFIC_PREVIEW_ROW_LIMIT}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch lg:[&>*]:min-h-0">
              <TrafficDataTableCard
                section={dashboardData.trafficByDevice}
                expandable
                previewRowLimit={TRAFFIC_PREVIEW_ROW_LIMIT}
              />
              <TrafficSourcesCard
                referrers={dashboardData.referrers}
                utmByParam={dashboardData.utmByParam}
                expandable
                previewRowLimit={TRAFFIC_PREVIEW_ROW_LIMIT}
                projectId={projectId}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch lg:[&>*]:min-h-0">
              <div className="lg:col-span-2">
                <TrafficDataTableCard
                  section={dashboardData.topPages}
                  expandable
                  previewRowLimit={TRAFFIC_PREVIEW_ROW_LIMIT}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
