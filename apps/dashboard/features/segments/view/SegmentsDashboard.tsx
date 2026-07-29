"use client"

import { useCallback, useEffect, useState } from "react"
import { SegmentsDashboardSkeleton } from "@/features/dashboard/view/dashboard-skeletons"
import { getSegmentsEmptyDashboardData } from "@/features/segments/controller/segments-empty-data"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import type { SegmentsDashboardData } from "@/features/segments/model/segments"
import { SegmentsPerformanceCards } from "@/features/segments/view/SegmentsPerformanceCards"
import { SegmentsSummaryKpiRow } from "@/features/segments/view/SegmentsSummaryKpiRow"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import { useDashboardPreference } from "@/hooks/use-dashboard-preference"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"
import { useDashboardSegmentFilter } from "@/hooks/use-dashboard-segment-filter"
import {
  buildAnalyticsApiPath,
  shouldUseInitialTabData,
} from "@/lib/dashboard/analytics-query"

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
  const [isLoading, setIsLoading] = useState(false)
  const [activeKpiId, setActiveKpiId] = useDashboardPreference(
    projectId,
    "kpi:segments",
    (raw) => raw ?? initialData.summaryKpis[0]?.label ?? ""
  )

  const fetchSegmentsForRange = useCallback(
    async (rangeId: typeof dateRangeId, signal?: AbortSignal) => {
      setIsLoading(true)

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
          setDashboardData(getSegmentsEmptyDashboardData(projectId, rangeId))
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
        setDashboardData(getSegmentsEmptyDashboardData(projectId, rangeId))
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false)
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
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    void fetchSegmentsForRange(dateRangeId, controller.signal)
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
      void fetchSegmentsForRange(dateRangeId, controller.signal)
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

      {isTabLoading || isLoading ? (
        <SegmentsDashboardSkeleton />
      ) : (
        <div className="flex flex-col gap-4">
          <SegmentsSummaryKpiRow
            kpis={dashboardData.summaryKpis}
            activeKpiId={activeKpiId}
            onKpiSelect={setActiveKpiId}
          />

          <SegmentsPerformanceCards data={dashboardData} />
        </div>
      )}
    </div>
  )
}
