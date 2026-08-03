"use client"

import { useCallback, useEffect, useState } from "react"
import { SegmentsDashboardSkeleton } from "@/features/dashboard/view/dashboard-skeletons"
import { getSegmentsEmptyDashboardData } from "@/features/segments/controller/segments-empty-data"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import type { SegmentsDashboardData } from "@/features/segments/model/segments"
import { SavedSegmentsCard } from "@/features/segments/view/SavedSegmentsCard"
import { SegmentsPerformanceCards } from "@/features/segments/view/SegmentsPerformanceCards"
import { SegmentsSummaryKpiRow } from "@/features/segments/view/SegmentsSummaryKpiRow"
import { CohortRetentionSection } from "@/features/retention/view/CohortRetentionSection"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import { useDashboardPreference } from "@/hooks/use-dashboard-preference"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"
import { useDashboardSegmentFilter } from "@/hooks/use-dashboard-segment-filter"
import type { AnalyticsFetchMode } from "@/lib/dashboard/analytics-fetch-mode"
import {
  buildAnalyticsApiPath,
  shouldUseInitialTabData,
} from "@/lib/dashboard/analytics-query"
import { cn } from "@workspace/ui/lib/utils"

const SEGMENTS_REFETCH_MS = 60_000

type SegmentsDashboardProps = {
  data: SegmentsDashboardData
  projectId: string
  isActive?: boolean
  isLoading?: boolean
}

export function SegmentsDashboard({
  data: initialData,
  projectId,
  isActive = true,
  isLoading: isTabLoading = false,
}: SegmentsDashboardProps) {
  const { dateRangeId, customRange, setDateRangeId, setCustomRange } =
    useDashboardDateRange()
  const { utmFilter } = useDashboardUtmFilter()
  const { segmentId } = useDashboardSegmentFilter()
  const [dashboardData, setDashboardData] = useState(initialData)
  const [isBlockingLoad, setIsBlockingLoad] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeKpiId, setActiveKpiId] = useDashboardPreference(
    projectId,
    "kpi:segments",
    (raw) => raw ?? initialData.summaryKpis[0]?.label ?? ""
  )

  const fetchSegmentsForRange = useCallback(
    async (
      rangeId: typeof dateRangeId,
      signal?: AbortSignal,
      mode: AnalyticsFetchMode = "blocking"
    ) => {
      if (mode === "blocking") setIsBlockingLoad(true)
      else setIsRefreshing(true)

      const url = buildAnalyticsApiPath(
        `/api/landing-pages/${encodeURIComponent(projectId)}/segments`,
        { rangeId, customRange, utmFilter, segmentId }
      )
      try {
        const res = await fetch(url, { cache: "no-store", signal })
        if (!res.ok) {
          if (process.env.NODE_ENV === "development") {
            const body = await res.text().catch(() => "")
            console.error(
              `[segments] client fetch ${res.status}`,
              body.slice(0, 200)
            )
          }
          if (mode === "blocking") {
            setDashboardData(getSegmentsEmptyDashboardData(projectId, rangeId))
          }
          return
        }
        const next = (await res.json()) as SegmentsDashboardData
        setDashboardData(next)
        setActiveKpiId((current) =>
          next.summaryKpis.some((kpi) => kpi.label === current)
            ? current
            : (next.summaryKpis[0]?.label ?? "")
        )
      } catch (err) {
        if (signal?.aborted) return
        if (process.env.NODE_ENV === "development") {
          console.error("[segments] client fetch failed", err)
        }
        if (mode === "blocking") {
          setDashboardData(getSegmentsEmptyDashboardData(projectId, rangeId))
        }
      } finally {
        if (!signal?.aborted) {
          if (mode === "blocking") setIsBlockingLoad(false)
          else setIsRefreshing(false)
        }
      }
    },
    [projectId, customRange, utmFilter, segmentId, setActiveKpiId]
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
    void fetchSegmentsForRange(dateRangeId, controller.signal, "background")
    return () => controller.abort()
  }, [
    customRange,
    dateRangeId,
    utmFilter,
    segmentId,
    initialData,
    fetchSegmentsForRange,
  ])

  useEffect(() => {
    if (!isActive) return

    const controller = new AbortController()
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      void fetchSegmentsForRange(dateRangeId, controller.signal, "background")
    }, SEGMENTS_REFETCH_MS)

    return () => {
      controller.abort()
      window.clearInterval(id)
    }
  }, [
    customRange,
    dateRangeId,
    utmFilter,
    segmentId,
    fetchSegmentsForRange,
    isActive,
  ])

  const showSkeleton = isTabLoading || isBlockingLoad

  return (
    <div className="flex flex-col gap-4 px-6 pb-6 lg:px-8">
      <OverviewHeader
        title="Segments"
        projectId={projectId}
        dateRangeOptions={dashboardData.dateRangeOptions}
        dateRangeId={dateRangeId}
        customRange={customRange}
        onDateRangeChange={setDateRangeId}
        onCustomRangeChange={setCustomRange}
      />

      {showSkeleton ? (
        <SegmentsDashboardSkeleton />
      ) : (
        <div
          className={cn(
            "flex flex-col gap-4 transition-opacity",
            isRefreshing && "opacity-80"
          )}
          aria-busy={isRefreshing}
        >
          <SegmentsSummaryKpiRow
            kpis={dashboardData.summaryKpis}
            activeKpiId={activeKpiId}
            onKpiSelect={setActiveKpiId}
          />

          <SavedSegmentsCard projectId={projectId} />

          <CohortRetentionSection projectId={projectId} />

          <SegmentsPerformanceCards data={dashboardData} />
        </div>
      )}
    </div>
  )
}
