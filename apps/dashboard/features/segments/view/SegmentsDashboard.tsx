"use client"

import { useCallback, useEffect, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { getSegmentsEmptyDashboardData } from "@/features/segments/controller/segments-empty-data"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import type { SegmentsDashboardData } from "@/features/segments/model/segments"
import { SegmentsPerformanceTableCard } from "@/features/segments/view/SegmentsPerformanceTableCard"
import { SegmentsSummaryKpiRow } from "@/features/segments/view/SegmentsSummaryKpiRow"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"

const SEGMENTS_REFETCH_MS = 30_000

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
  const [dashboardData, setDashboardData] = useState(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [activeKpiId, setActiveKpiId] = useState<string>(
    initialData.summaryKpis[0]?.label ?? ""
  )

  const fetchSegmentsForRange = useCallback(
    async (rangeId: typeof dateRangeId, signal?: AbortSignal) => {
      setIsLoading(true)

      const url = `/api/landing-pages/${encodeURIComponent(projectId)}/segments?range_id=${encodeURIComponent(rangeId)}`
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
        if (!next.summaryKpis.find((k) => k.label === activeKpiId)) {
          setActiveKpiId(next.summaryKpis[0]?.label ?? "")
        }
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
    [projectId]
  )

  useEffect(() => {
    if (dateRangeId === initialData.defaultDateRangeId) {
      setDashboardData(initialData)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    void fetchSegmentsForRange(dateRangeId, controller.signal)
    return () => controller.abort()
  }, [dateRangeId, initialData, fetchSegmentsForRange])

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
  }, [dateRangeId, fetchSegmentsForRange, isActive])

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

        <div className="grid grid-cols-2 items-start gap-4">
          <div className="flex flex-col gap-4">
            <SegmentsPerformanceTableCard
              section={dashboardData.performanceByLocation}
            />
            <SegmentsPerformanceTableCard
              section={dashboardData.performanceByTime}
            />
          </div>
          <SegmentsPerformanceTableCard
            section={dashboardData.performanceByDevice}
          />
        </div>
      </div>
    </div>
  )
}
