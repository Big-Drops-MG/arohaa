"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertsDashboardSkeleton } from "@/features/dashboard/view/dashboard-skeletons"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import type { AlertsDashboardData } from "@/features/alerts/model/alerts"
import { AlertsListCard } from "@/features/alerts/view/AlertsListCard"
import { getAlertsEmptyDashboardData } from "@/features/alerts/controller/alerts-empty-data"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"
import { useDashboardSegmentFilter } from "@/hooks/use-dashboard-segment-filter"
import type { AnalyticsFetchMode } from "@/lib/dashboard/analytics-fetch-mode"
import {
  buildAnalyticsApiPath,
  shouldUseInitialTabData,
} from "@/lib/dashboard/analytics-query"
import { cn } from "@workspace/ui/lib/utils"

const ALERTS_REFETCH_MS = 60_000

type AlertsDashboardProps = {
  data: AlertsDashboardData
  projectId: string
  isActive?: boolean
  isLoading?: boolean
}

export function AlertsDashboard({
  data: initialData,
  projectId,
  isActive = true,
  isLoading: isTabLoading = false,
}: AlertsDashboardProps) {
  const { dateRangeId, customRange, setDateRangeId, setCustomRange } =
    useDashboardDateRange()
  const { utmFilter } = useDashboardUtmFilter()
  const { segmentId } = useDashboardSegmentFilter()
  const [dashboardData, setDashboardData] = useState(initialData)
  const [isBlockingLoad, setIsBlockingLoad] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchAlertsForRange = useCallback(
    async (
      rangeId: typeof dateRangeId,
      signal?: AbortSignal,
      mode: AnalyticsFetchMode = "blocking"
    ) => {
      if (mode === "blocking") setIsBlockingLoad(true)
      else setIsRefreshing(true)

      const url = buildAnalyticsApiPath(
        `/api/landing-pages/${encodeURIComponent(projectId)}/alerts`,
        { rangeId, customRange, utmFilter, segmentId }
      )
      try {
        const res = await fetch(url, { cache: "no-store", signal })
        if (!res.ok) {
          if (process.env.NODE_ENV === "development") {
            const body = await res.text().catch(() => "")
            console.error(
              `[alerts] client fetch ${res.status}`,
              body.slice(0, 200)
            )
          }
          if (mode === "blocking") {
            setDashboardData(getAlertsEmptyDashboardData(projectId, rangeId))
          }
          return
        }
        const next = (await res.json()) as AlertsDashboardData
        setDashboardData(next)
      } catch (err) {
        if (signal?.aborted) return
        if (process.env.NODE_ENV === "development") {
          console.error("[alerts] client fetch failed", err)
        }
        if (mode === "blocking") {
          setDashboardData(getAlertsEmptyDashboardData(projectId, rangeId))
        }
      } finally {
        if (!signal?.aborted) {
          if (mode === "blocking") setIsBlockingLoad(false)
          else setIsRefreshing(false)
        }
      }
    },
    [projectId, customRange, utmFilter, segmentId]
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
    void fetchAlertsForRange(dateRangeId, controller.signal, "background")
    return () => controller.abort()
  }, [
    customRange,
    dateRangeId,
    utmFilter,
    segmentId,
    initialData,
    fetchAlertsForRange,
  ])

  useEffect(() => {
    if (!isActive) return

    const controller = new AbortController()
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      void fetchAlertsForRange(dateRangeId, controller.signal, "background")
    }, ALERTS_REFETCH_MS)

    return () => {
      controller.abort()
      window.clearInterval(id)
    }
  }, [
    customRange,
    dateRangeId,
    utmFilter,
    segmentId,
    fetchAlertsForRange,
    isActive,
  ])

  return (
    <div className="flex flex-col gap-4 px-6 pb-6 lg:px-8">
      <OverviewHeader
        title="Alerts"
        projectId={projectId}
        dateRangeOptions={dashboardData.dateRangeOptions}
        dateRangeId={dateRangeId}
        customRange={customRange}
        onDateRangeChange={setDateRangeId}
        onCustomRangeChange={setCustomRange}
      />

      {isTabLoading || isBlockingLoad ? (
        <AlertsDashboardSkeleton />
      ) : (
        <div
          className={cn("transition-opacity", isRefreshing && "opacity-80")}
          aria-busy={isRefreshing}
        >
          <AlertsListCard items={dashboardData.items} projectId={projectId} />
        </div>
      )}
    </div>
  )
}
