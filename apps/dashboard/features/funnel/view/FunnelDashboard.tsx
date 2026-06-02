"use client"

import { useCallback, useEffect, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { getFunnelEmptyDashboardData } from "@/features/funnel/controller/funnel-empty-data"
import type { FunnelDashboardData } from "@/features/funnel/model/funnel"
import { FunnelDropOffCard } from "@/features/funnel/view/FunnelDropOffCard"
import { FunnelKpiRow } from "@/features/funnel/view/FunnelKpiRow"
import { FunnelMultiStepCard } from "@/features/funnel/view/FunnelMultiStepCard"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"

const FUNNEL_REFETCH_MS = 30_000

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
  const { dateRangeId, setDateRangeId } = useDashboardDateRange()
  const [dashboardData, setDashboardData] = useState(initialData)
  const [isLoading, setIsLoading] = useState(false)

  const fetchFunnelForRange = useCallback(
    async (rangeId: typeof dateRangeId, signal?: AbortSignal) => {
      setIsLoading(true)

      const url = `/api/landing-pages/${encodeURIComponent(projectId)}/funnel?range_id=${encodeURIComponent(rangeId)}`
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
          setDashboardData(getFunnelEmptyDashboardData(projectId, rangeId))
          return
        }
        const next = (await res.json()) as FunnelDashboardData
        setDashboardData(next)
      } catch (err) {
        if (signal?.aborted) return
        if (process.env.NODE_ENV === "development") {
          console.error("[funnel] client fetch failed", err)
        }
        setDashboardData(getFunnelEmptyDashboardData(projectId, rangeId))
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
    void fetchFunnelForRange(dateRangeId, controller.signal)
    return () => controller.abort()
  }, [dateRangeId, initialData, fetchFunnelForRange])

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
  }, [dateRangeId, fetchFunnelForRange, isActive])

  return (
    <div className="flex flex-col gap-4 px-6 pb-6 lg:px-8">
      <OverviewHeader
        title="Funnel"
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
        <FunnelKpiRow metrics={dashboardData.metrics} />

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-stretch gap-4">
          <FunnelMultiStepCard steps={dashboardData.multiStepSteps} />
          <FunnelDropOffCard rows={dashboardData.dropOffRows} />
        </div>
      </div>
    </div>
  )
}
