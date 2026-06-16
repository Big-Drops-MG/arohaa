"use client"

import { useCallback, useEffect, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { getTrafficEmptyDashboardData } from "@/features/traffic/controller/traffic-empty-data"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import type {
  TrafficDashboardData,
  TrafficKpiMetricId,
} from "@/features/traffic/model/traffic"
import { TrafficDataTableCard } from "@/features/traffic/view/TrafficDataTableCard"
import { TrafficKpiRow } from "@/features/traffic/view/TrafficKpiRow"
import { TrafficSourcesCard } from "@/features/traffic/view/TrafficSourcesCard"
import { TRAFFIC_PREVIEW_ROW_LIMIT } from "@/features/traffic/view/traffic-card-layout"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"

const TRAFFIC_REFETCH_MS = 30_000

type TrafficDashboardProps = {
  data: TrafficDashboardData
  projectId: string
  isActive?: boolean
}

export function TrafficDashboard({
  data: initialData,
  projectId,
  isActive = true,
}: TrafficDashboardProps) {
  const { dateRangeId, setDateRangeId } = useDashboardDateRange()
  const [activeKpiId, setActiveKpiId] = useState<TrafficKpiMetricId>(
    initialData.defaultKpiMetricId
  )
  const [dashboardData, setDashboardData] = useState(initialData)
  const [isLoading, setIsLoading] = useState(false)

  const fetchTrafficForRange = useCallback(
    async (rangeId: typeof dateRangeId, signal?: AbortSignal) => {
      setIsLoading(true)

      const url = `/api/landing-pages/${encodeURIComponent(projectId)}/traffic?range_id=${encodeURIComponent(rangeId)}`
      try {
        const res = await fetch(url, { cache: "no-store", signal })
        if (!res.ok) {
          if (process.env.NODE_ENV === "development") {
            const body = await res.text().catch(() => "")
            console.error(
              `[traffic] client fetch ${res.status}`,
              body.slice(0, 200)
            )
          }
          setDashboardData(getTrafficEmptyDashboardData(projectId, rangeId))
          return
        }
        const next = (await res.json()) as TrafficDashboardData
        setDashboardData(next)
      } catch (err) {
        if (signal?.aborted) return
        if (process.env.NODE_ENV === "development") {
          console.error("[traffic] client fetch failed", err)
        }
        setDashboardData(getTrafficEmptyDashboardData(projectId, rangeId))
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
    void fetchTrafficForRange(dateRangeId, controller.signal)
    return () => controller.abort()
  }, [dateRangeId, initialData, fetchTrafficForRange])

  useEffect(() => {
    if (!isActive) return

    const controller = new AbortController()
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      void fetchTrafficForRange(dateRangeId, controller.signal)
    }, TRAFFIC_REFETCH_MS)

    return () => {
      controller.abort()
      window.clearInterval(id)
    }
  }, [dateRangeId, fetchTrafficForRange, isActive])

  return (
    <div className="flex flex-col gap-4 px-6 pb-6 lg:px-8">
      <OverviewHeader
        title="Traffic"
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
        <TrafficKpiRow
          kpis={dashboardData.kpis}
          activeKpiId={activeKpiId}
          onKpiSelect={setActiveKpiId}
        />

        <div className="flex flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch lg:[&>*]:min-h-0">
            <TrafficDataTableCard
              section={dashboardData.trafficByTime}
              expandable
              previewRowLimit={TRAFFIC_PREVIEW_ROW_LIMIT}
              sortByColumnId=""
            />
            <TrafficDataTableCard
              section={dashboardData.trafficByLocation}
              expandable
              previewRowLimit={TRAFFIC_PREVIEW_ROW_LIMIT}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch lg:[&>*]:min-h-0">
            <TrafficDataTableCard
              section={dashboardData.trafficByDevice}
              expandable
              previewRowLimit={TRAFFIC_PREVIEW_ROW_LIMIT}
            />
            <TrafficSourcesCard
              referrers={dashboardData.referrers}
              utmParameters={dashboardData.utmParameters}
              expandable
              previewRowLimit={TRAFFIC_PREVIEW_ROW_LIMIT}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch lg:[&>*]:min-h-0">
            <div className="lg:col-span-2">
              <TrafficDataTableCard
                section={dashboardData.topPages}
                expandable
                previewRowLimit={TRAFFIC_PREVIEW_ROW_LIMIT}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
