"use client"

import { useCallback, useEffect, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { getExperimentsEmptyDashboardData } from "@/features/experiments/controller/experiments-empty-data"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import type { ExperimentsDashboardData } from "@/features/experiments/model/experiments"
import { ExperimentsListCard } from "@/features/experiments/view/ExperimentsListCard"
import { ExperimentsPerformanceTableCard } from "@/features/experiments/view/ExperimentsPerformanceTableCard"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"

const EXPERIMENTS_REFETCH_MS = 30_000

type ExperimentsDashboardProps = {
  data: ExperimentsDashboardData
  projectId: string
  isActive?: boolean
}

export function ExperimentsDashboard({
  data: initialData,
  projectId,
  isActive = true,
}: ExperimentsDashboardProps) {
  const { dateRangeId, setDateRangeId } = useDashboardDateRange()
  const [dashboardData, setDashboardData] = useState(initialData)
  const [isLoading, setIsLoading] = useState(false)

  const fetchExperimentsForRange = useCallback(
    async (rangeId: typeof dateRangeId, signal?: AbortSignal) => {
      setIsLoading(true)

      const url = `/api/landing-pages/${encodeURIComponent(projectId)}/experiments?range_id=${encodeURIComponent(rangeId)}`
      try {
        const res = await fetch(url, { cache: "no-store", signal })
        if (!res.ok) {
          if (process.env.NODE_ENV === "development") {
            const body = await res.text().catch(() => "")
            console.error(
              `[experiments] client fetch ${res.status}`,
              body.slice(0, 200)
            )
          }
          setDashboardData(getExperimentsEmptyDashboardData(projectId, rangeId))
          return
        }
        const next = (await res.json()) as ExperimentsDashboardData
        setDashboardData(next)
      } catch (err) {
        if (signal?.aborted) return
        if (process.env.NODE_ENV === "development") {
          console.error("[experiments] client fetch failed", err)
        }
        setDashboardData(getExperimentsEmptyDashboardData(projectId, rangeId))
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
    void fetchExperimentsForRange(dateRangeId, controller.signal)
    return () => controller.abort()
  }, [dateRangeId, initialData, fetchExperimentsForRange])

  useEffect(() => {
    if (!isActive) return

    const controller = new AbortController()
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      void fetchExperimentsForRange(dateRangeId, controller.signal)
    }, EXPERIMENTS_REFETCH_MS)

    return () => {
      controller.abort()
      window.clearInterval(id)
    }
  }, [dateRangeId, fetchExperimentsForRange, isActive])

  return (
    <div className="flex flex-col gap-4 px-6 pb-6 lg:px-8">
      <OverviewHeader
        title="Experiments"
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
        <ExperimentsListCard experiments={dashboardData.experiments} />

        <div className="grid grid-cols-2 items-stretch gap-4">
          <ExperimentsPerformanceTableCard
            section={dashboardData.variantPerformance}
          />
          <ExperimentsPerformanceTableCard
            section={dashboardData.performanceByLocation}
          />
        </div>
      </div>
    </div>
  )
}
