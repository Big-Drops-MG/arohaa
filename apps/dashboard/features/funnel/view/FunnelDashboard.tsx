"use client"

import { useCallback, useEffect, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { getFunnelEmptyDashboardData } from "@/features/funnel/controller/funnel-empty-data"
import type { FunnelDashboardData } from "@/features/funnel/model/funnel"
import { FUNNEL_DEFAULT_KPI_METRIC_ID } from "@/features/funnel/model/funnel"
import { FunnelDetailCards } from "@/features/funnel/view/FunnelDetailCards"
import { FunnelKpiRow } from "@/features/funnel/view/FunnelKpiRow"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"
import {
  buildAnalyticsApiPath,
  shouldUseInitialTabData,
} from "@/lib/dashboard/analytics-query"

const FUNNEL_REFETCH_MS = 60_000

type FunnelDashboardProps = {
  data: FunnelDashboardData
  projectId: string
  isActive?: boolean
}

export function FunnelDashboard({
  data: initialData,
  projectId,
  isActive = true,
}: FunnelDashboardProps) {
  const { dateRangeId, customRange, setDateRangeId, setCustomRange } =
    useDashboardDateRange()
  const { utmFilter } = useDashboardUtmFilter()
  const [activeKpiId, setActiveKpiId] = useState(FUNNEL_DEFAULT_KPI_METRIC_ID)
  const [dashboardData, setDashboardData] = useState(initialData)
  const [isLoading, setIsLoading] = useState(false)

  const fetchFunnelForRange = useCallback(
    async (rangeId: typeof dateRangeId, signal?: AbortSignal) => {
      setIsLoading(true)

      const url = buildAnalyticsApiPath(
        `/api/landing-pages/${encodeURIComponent(projectId)}/funnel`,
        { rangeId, customRange, utmFilter }
      )
      try {
        const res = await fetch(url, { cache: "no-store", signal })
        if (!res.ok) {
          if (process.env.NODE_ENV === "development") {
            const body = await res.text().catch(() => "")
            console.error(
              `[funnel] client fetch ${res.status}`,
              body.slice(0, 200)
            )
          }
          setDashboardData((prev) =>
            getFunnelEmptyDashboardData(projectId, rangeId, prev.formType)
          )
          return
        }
        const next = (await res.json()) as FunnelDashboardData
        setDashboardData(next)
      } catch (err) {
        if (signal?.aborted) return
        if (process.env.NODE_ENV === "development") {
          console.error("[funnel] client fetch failed", err)
        }
        setDashboardData((prev) =>
          getFunnelEmptyDashboardData(projectId, rangeId, prev.formType)
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
    setActiveKpiId(FUNNEL_DEFAULT_KPI_METRIC_ID)

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
    void fetchFunnelForRange(dateRangeId, controller.signal)
    return () => controller.abort()
  }, [customRange, dateRangeId, utmFilter, initialData, fetchFunnelForRange])

  useEffect(() => {
    if (isActive) {
      setActiveKpiId(FUNNEL_DEFAULT_KPI_METRIC_ID)
    }
  }, [isActive])

  useEffect(() => {
    if (!isActive) return

    const controller = new AbortController()
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      void fetchFunnelForRange(dateRangeId, controller.signal)
    }, FUNNEL_REFETCH_MS)

    return () => {
      controller.abort()
      window.clearInterval(id)
    }
  }, [customRange, dateRangeId, utmFilter, fetchFunnelForRange, isActive])

  return (
    <div className="flex flex-col gap-4 px-6 pb-6 lg:px-8">
      <OverviewHeader
        title="Funnel"
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
        <FunnelKpiRow
          metrics={dashboardData.metrics}
          activeKpiId={activeKpiId}
          onKpiSelect={setActiveKpiId}
        />

        <FunnelDetailCards
          formType={dashboardData.formType}
          multiStepSteps={dashboardData.multiStepSteps}
          dropOffRows={dashboardData.dropOffRows}
        />
      </div>
    </div>
  )
}
