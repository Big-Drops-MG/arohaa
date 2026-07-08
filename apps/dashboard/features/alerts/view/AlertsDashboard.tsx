"use client"

import { useCallback, useEffect, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import type { AlertsDashboardData } from "@/features/alerts/model/alerts"
import { AlertsListCard } from "@/features/alerts/view/AlertsListCard"
import { getAlertsEmptyDashboardData } from "@/features/alerts/controller/alerts-empty-data"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"
import {
  buildAnalyticsApiPath,
  shouldUseInitialTabData,
} from "@/lib/dashboard/analytics-query"

const ALERTS_REFETCH_MS = 60_000

type AlertsDashboardProps = {
  data: AlertsDashboardData
  projectId: string
  isActive?: boolean
}

export function AlertsDashboard({
  data: initialData,
  projectId,
  isActive = true,
}: AlertsDashboardProps) {
  const { dateRangeId, setDateRangeId } = useDashboardDateRange()
  const { utmFilter } = useDashboardUtmFilter()
  const [dashboardData, setDashboardData] = useState(initialData)
  const [isLoading, setIsLoading] = useState(false)

  const fetchAlertsForRange = useCallback(
    async (rangeId: typeof dateRangeId, signal?: AbortSignal) => {
      setIsLoading(true)

      const url = buildAnalyticsApiPath(
        `/api/landing-pages/${encodeURIComponent(projectId)}/alerts`,
        { rangeId, utmFilter }
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
          setDashboardData(getAlertsEmptyDashboardData(projectId, rangeId))
          return
        }
        const next = (await res.json()) as AlertsDashboardData
        setDashboardData(next)
      } catch (err) {
        if (signal?.aborted) return
        if (process.env.NODE_ENV === "development") {
          console.error("[alerts] client fetch failed", err)
        }
        setDashboardData(getAlertsEmptyDashboardData(projectId, rangeId))
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
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    void fetchAlertsForRange(dateRangeId, controller.signal)
    return () => controller.abort()
  }, [dateRangeId, utmFilter, initialData, fetchAlertsForRange])

  useEffect(() => {
    if (!isActive) return

    const controller = new AbortController()
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      void fetchAlertsForRange(dateRangeId, controller.signal)
    }, ALERTS_REFETCH_MS)

    return () => {
      controller.abort()
      window.clearInterval(id)
    }
  }, [dateRangeId, utmFilter, fetchAlertsForRange, isActive])

  return (
    <div className="flex flex-col gap-4 px-6 pb-6 lg:px-8">
      <OverviewHeader
        title="Alerts"
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
        <AlertsListCard items={dashboardData.items} />
      </div>
    </div>
  )
}
