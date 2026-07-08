"use client"

import { useCallback, useEffect, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { getSegmentsEmptyDashboardData } from "@/features/segments/controller/segments-empty-data"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import type { SegmentsDashboardData } from "@/features/segments/model/segments"
import { SegmentsPerformanceCards } from "@/features/segments/view/SegmentsPerformanceCards"
import { SegmentsSummaryKpiRow } from "@/features/segments/view/SegmentsSummaryKpiRow"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"
import {
  buildAnalyticsApiPath,
  shouldUseInitialTabData,
} from "@/lib/dashboard/analytics-query"

const SEGMENTS_REFETCH_MS = 60_000

type SegmentsDashboardProps = {
  data: SegmentsDashboardData
  projectId: string
  isActive?: boolean
}

export function SegmentsDashboard({
  data: initialData,
  projectId,
  isActive = true,
}: SegmentsDashboardProps) {
  const { dateRangeId, setDateRangeId } = useDashboardDateRange()
  const { utmFilter } = useDashboardUtmFilter()
  const [dashboardData, setDashboardData] = useState(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [activeKpiId, setActiveKpiId] = useState<string>(
    initialData.summaryKpis[0]?.label ?? ""
  )

  const fetchSegmentsForRange = useCallback(
    async (rangeId: typeof dateRangeId, signal?: AbortSignal) => {
      setIsLoading(true)

      const url = buildAnalyticsApiPath(
        `/api/landing-pages/${encodeURIComponent(projectId)}/segments`,
        { rangeId, utmFilter }
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
    [projectId, utmFilter]
  )

  useEffect(() => {
    if (
      shouldUseInitialTabData(
        dateRangeId,
        initialData.defaultDateRangeId,
        utmFilter
      )
    ) {
      setDashboardData(initialData)
      setActiveKpiId(initialData.summaryKpis[0]?.label ?? "")
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    void fetchSegmentsForRange(dateRangeId, controller.signal)
    return () => controller.abort()
  }, [dateRangeId, utmFilter, initialData, fetchSegmentsForRange])

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
  }, [dateRangeId, utmFilter, fetchSegmentsForRange, isActive])

  return (
    <div className="flex flex-col gap-4 px-6 pb-6 lg:px-8">
      <OverviewHeader
        title="Segments"
        dateRangeOptions={dashboardData.dateRangeOptions}
        dateRangeId={dateRangeId}
        onDateRangeChange={setDateRangeId}
      />

      <div
        className={cn(
          "flex flex-col gap-4",
          isLoading && "pointer-events-none opacity-60"
        )}
        aria-busy={isLoading}
      >
        <SegmentsSummaryKpiRow
          kpis={dashboardData.summaryKpis}
          activeKpiId={activeKpiId}
          onKpiSelect={setActiveKpiId}
        />

        <SegmentsPerformanceCards data={dashboardData} />
      </div>
    </div>
  )
}
