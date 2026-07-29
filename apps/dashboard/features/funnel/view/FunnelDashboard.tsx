"use client"

import { useCallback, useEffect, useState } from "react"
import { getFunnelEmptyDashboardData } from "@/features/funnel/controller/funnel-empty-data"
import { FunnelDashboardSkeleton } from "@/features/dashboard/view/dashboard-skeletons"
import {
  FUNNEL_DEFAULT_KPI_METRIC_ID,
  FUNNEL_KPI_METRIC_IDS,
} from "@/features/funnel/model/funnel"
import type {
  FunnelDashboardData,
  FunnelKpiMetricId,
} from "@/features/funnel/model/funnel"
import { FunnelDetailCards } from "@/features/funnel/view/FunnelDetailCards"
import { FunnelKpiRow } from "@/features/funnel/view/FunnelKpiRow"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import { useDashboardPreference } from "@/hooks/use-dashboard-preference"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"
import { useDashboardSegmentFilter } from "@/hooks/use-dashboard-segment-filter"
import {
  buildAnalyticsApiPath,
  shouldUseInitialTabData,
} from "@/lib/dashboard/analytics-query"

const FUNNEL_REFETCH_MS = 60_000

type FunnelDashboardProps = {
  data: FunnelDashboardData
  projectId: string
  isActive?: boolean
  isLoading?: boolean
}

export function FunnelDashboard({
  data: initialData,
  projectId,
  isActive = true,
  isLoading: isTabLoading = false,
}: FunnelDashboardProps) {
  const { dateRangeId, customRange, setDateRangeId, setCustomRange } =
    useDashboardDateRange()
  const { utmFilter } = useDashboardUtmFilter()
  const { segmentId } = useDashboardSegmentFilter()
  const [activeKpiId, setActiveKpiId] = useDashboardPreference(
    projectId,
    "kpi:funnel",
    (raw) =>
      raw && (FUNNEL_KPI_METRIC_IDS as readonly string[]).includes(raw)
        ? (raw as FunnelKpiMetricId)
        : FUNNEL_DEFAULT_KPI_METRIC_ID
  )
  const [dashboardData, setDashboardData] = useState(initialData)
  const [isLoading, setIsLoading] = useState(false)

  const fetchFunnelForRange = useCallback(
    async (rangeId: typeof dateRangeId, signal?: AbortSignal) => {
      setIsLoading(true)

      const url = buildAnalyticsApiPath(
        `/api/landing-pages/${encodeURIComponent(projectId)}/funnel`,
        { rangeId, customRange, utmFilter, segmentId }
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
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    void fetchFunnelForRange(dateRangeId, controller.signal)
    return () => controller.abort()
  }, [
    customRange,
    dateRangeId,
    utmFilter,
    segmentId,
    initialData,
    fetchFunnelForRange,
  ])

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
  }, [
    customRange,
    dateRangeId,
    utmFilter,
    segmentId,
    fetchFunnelForRange,
    isActive,
  ])

  return (
    <div className="flex flex-col gap-4 px-6 pb-6 lg:px-8">
      <OverviewHeader
        title="Funnel"
        projectId={projectId}
        dateRangeOptions={dashboardData.dateRangeOptions}
        dateRangeId={dateRangeId}
        customRange={customRange}
        onDateRangeChange={setDateRangeId}
        onCustomRangeChange={setCustomRange}
      />

      {isTabLoading || isLoading ? (
        <FunnelDashboardSkeleton />
      ) : (
        <div className="flex flex-col gap-4">
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
      )}
    </div>
  )
}
