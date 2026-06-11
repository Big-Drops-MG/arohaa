"use client"

import { useCallback, useEffect, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { getEventTrackingEmptyDashboardData } from "@/features/event-tracking/controller/event-tracking-empty-data"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import type { EventTrackingDashboardData } from "@/features/event-tracking/model/event-tracking"
import { EventTrackingKpiPieChart } from "@/features/event-tracking/view/EventTrackingKpiPieChart"
import { EventTrackingKpiRow } from "@/features/event-tracking/view/EventTrackingKpiRow"
import { EventTrackingSubmissionTableCard } from "@/features/event-tracking/view/EventTrackingSubmissionTableCard"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"

const EVENTS_REFETCH_MS = 30_000

type EventTrackingDashboardProps = {
  data: EventTrackingDashboardData
  projectId: string
  isActive?: boolean
}

export function EventTrackingDashboard({
  data: initialData,
  projectId,
  isActive = true,
}: EventTrackingDashboardProps) {
  const { dateRangeId, setDateRangeId } = useDashboardDateRange()
  const [dashboardData, setDashboardData] = useState(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [activeKpiId, setActiveKpiId] = useState<string>(
    initialData.kpis[0]?.label ?? ""
  )

  const fetchEventsForRange = useCallback(
    async (rangeId: typeof dateRangeId, signal?: AbortSignal) => {
      setIsLoading(true)

      const url = `/api/landing-pages/${encodeURIComponent(projectId)}/events?range_id=${encodeURIComponent(rangeId)}`
      try {
        const res = await fetch(url, { cache: "no-store", signal })
        if (!res.ok) {
          if (process.env.NODE_ENV === "development") {
            const body = await res.text().catch(() => "")
            console.error(
              `[events] client fetch ${res.status}`,
              body.slice(0, 200)
            )
          }
          setDashboardData(
            getEventTrackingEmptyDashboardData(projectId, rangeId)
          )
          return
        }
        const next = (await res.json()) as EventTrackingDashboardData
        setDashboardData(next)
        if (!next.kpis.find((k) => k.label === activeKpiId)) {
          setActiveKpiId(next.kpis[0]?.label ?? "")
        }
      } catch (err) {
        if (signal?.aborted) return
        if (process.env.NODE_ENV === "development") {
          console.error("[events] client fetch failed", err)
        }
        setDashboardData(getEventTrackingEmptyDashboardData(projectId, rangeId))
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
    void fetchEventsForRange(dateRangeId, controller.signal)
    return () => controller.abort()
  }, [dateRangeId, initialData, fetchEventsForRange])

  useEffect(() => {
    if (!isActive) return

    const controller = new AbortController()
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      void fetchEventsForRange(dateRangeId, controller.signal)
    }, EVENTS_REFETCH_MS)

    return () => {
      controller.abort()
      window.clearInterval(id)
    }
  }, [dateRangeId, fetchEventsForRange, isActive])

  return (
    <div className="flex flex-col gap-4 px-6 pb-6 lg:px-8">
      <OverviewHeader
        title="Event Tracking"
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
        <EventTrackingKpiRow
          kpis={dashboardData.kpis}
          activeKpiId={activeKpiId}
          onKpiSelect={setActiveKpiId}
        />

        <div className="grid grid-cols-2 items-stretch gap-4">
          <EventTrackingSubmissionTableCard
            rows={dashboardData.submissionRows}
          />
          <EventTrackingKpiPieChart segments={dashboardData.pieSegments} />
        </div>
      </div>
    </div>
  )
}
