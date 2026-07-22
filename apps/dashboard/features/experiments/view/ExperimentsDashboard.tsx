"use client"

import { useCallback, useEffect, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { getExperimentsEmptyDashboardData } from "@/features/experiments/controller/experiments-empty-data"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import type { ExperimentsDashboardData } from "@/features/experiments/model/experiments"
import { ExperimentsCards } from "@/features/experiments/view/ExperimentsCards"
import { ExperimentsSetupCard } from "@/features/experiments/view/ExperimentsSetupCard"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"
import {
  buildAnalyticsApiPath,
  shouldUseInitialTabData,
} from "@/lib/dashboard/analytics-query"

const EXPERIMENTS_REFETCH_MS = 60_000

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
  const { dateRangeId, customRange, setDateRangeId, setCustomRange } =
    useDashboardDateRange()
  const { utmFilter } = useDashboardUtmFilter()
  const [dashboardData, setDashboardData] = useState(initialData)
  const [isLoading, setIsLoading] = useState(false)

  const fetchExperimentsForRange = useCallback(
    async (rangeId: typeof dateRangeId, signal?: AbortSignal) => {
      setIsLoading(true)

      const url = buildAnalyticsApiPath(
        `/api/landing-pages/${encodeURIComponent(projectId)}/experiments`,
        { rangeId, customRange, utmFilter }
      )
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
          setDashboardData((prev) =>
            getExperimentsEmptyDashboardData(
              projectId,
              rangeId,
              prev.formType,
              prev.config,
              prev.siblings
            )
          )
          return
        }
        const next = (await res.json()) as ExperimentsDashboardData
        setDashboardData(next)
      } catch (err) {
        if (signal?.aborted) return
        if (process.env.NODE_ENV === "development") {
          console.error("[experiments] client fetch failed", err)
        }
        setDashboardData((prev) =>
          getExperimentsEmptyDashboardData(
            projectId,
            rangeId,
            prev.formType,
            prev.config,
            prev.siblings
          )
        )
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false)
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
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    void fetchExperimentsForRange(dateRangeId, controller.signal)
    return () => controller.abort()
  }, [
    customRange,
    dateRangeId,
    utmFilter,
    initialData,
    fetchExperimentsForRange,
  ])

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
  }, [customRange, dateRangeId, utmFilter, fetchExperimentsForRange, isActive])

  return (
    <div className="flex flex-col gap-4 px-6 pb-6 lg:px-8">
      <OverviewHeader
        title="Experiments"
        projectId={projectId}
        dateRangeOptions={dashboardData.dateRangeOptions}
        dateRangeId={dateRangeId}
        customRange={customRange}
        onDateRangeChange={setDateRangeId}
        onCustomRangeChange={setCustomRange}
      />

      <div
        className={cn(
          "flex flex-col gap-4",
          isLoading && "pointer-events-none opacity-60"
        )}
        aria-busy={isLoading}
      >
        <ExperimentsSetupCard
          projectId={projectId}
          config={dashboardData.config}
          siblings={dashboardData.siblings}
          onChanged={() => {
            void fetchExperimentsForRange(dateRangeId)
          }}
        />
        <ExperimentsCards data={dashboardData} />
      </div>
    </div>
  )
}
