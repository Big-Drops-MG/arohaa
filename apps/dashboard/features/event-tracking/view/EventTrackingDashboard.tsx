"use client"

import { useCallback, useEffect, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { getEventTrackingEmptyDashboardData } from "@/features/event-tracking/controller/event-tracking-empty-data"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import type {
  EventTrackingDashboardData,
  EventTrackingMetricId,
} from "@/features/event-tracking/model/event-tracking"
import { eventTrackingMetricOrder } from "@/features/event-tracking/model/event-tracking"
import { EVENT_TRACKING_PREVIEW_ROW_LIMIT } from "@/features/event-tracking/view/event-tracking-card-layout"
import { EventTrackingKpiPerformanceCard } from "@/features/event-tracking/view/EventTrackingKpiPerformanceCard"
import { EventTrackingKpiRow } from "@/features/event-tracking/view/EventTrackingKpiRow"
import { EventTrackingSubmissionOverTimeCard } from "@/features/event-tracking/view/EventTrackingSubmissionOverTimeCard"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"
import {
  buildAnalyticsApiPath,
  shouldUseInitialTabData,
} from "@/lib/dashboard/analytics-query"

const EVENTS_REFETCH_MS = 60_000

type EventTrackingDashboardProps = {
  data: EventTrackingDashboardData
  projectId: string
  isActive?: boolean
}

function defaultActiveKpiId(
  data: EventTrackingDashboardData
): EventTrackingMetricId {
  return (
    data.kpis[0]?.id ??
    eventTrackingMetricOrder(data.formType)[0] ??
    "total-events"
  )
}

export function EventTrackingDashboard({
  data: initialData,
  projectId,
  isActive = true,
}: EventTrackingDashboardProps) {
  const { dateRangeId, setDateRangeId } = useDashboardDateRange()
  const { utmFilter } = useDashboardUtmFilter()
  const [dashboardData, setDashboardData] = useState(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [activeKpiId, setActiveKpiId] = useState<EventTrackingMetricId>(
    defaultActiveKpiId(initialData)
  )

  const fetchEventsForRange = useCallback(
    async (rangeId: typeof dateRangeId, signal?: AbortSignal) => {
      setIsLoading(true)

      const url = buildAnalyticsApiPath(
        `/api/landing-pages/${encodeURIComponent(projectId)}/events`,
        { rangeId, utmFilter }
      )
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
          setDashboardData((prev) =>
            getEventTrackingEmptyDashboardData(
              projectId,
              rangeId,
              prev.formType
            )
          )
          return
        }
        const next = (await res.json()) as EventTrackingDashboardData
        setDashboardData(next)
        setActiveKpiId((current) =>
          next.kpis.some((kpi) => kpi.id === current)
            ? current
            : defaultActiveKpiId(next)
        )
      } catch (err) {
        if (signal?.aborted) return
        if (process.env.NODE_ENV === "development") {
          console.error("[events] client fetch failed", err)
        }
        setDashboardData((prev) =>
          getEventTrackingEmptyDashboardData(projectId, rangeId, prev.formType)
        )
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
      setActiveKpiId(defaultActiveKpiId(initialData))
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    void fetchEventsForRange(dateRangeId, controller.signal)
    return () => controller.abort()
  }, [dateRangeId, utmFilter, initialData, fetchEventsForRange])

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
  }, [dateRangeId, utmFilter, fetchEventsForRange, isActive])

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

        <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch lg:*:min-h-0">
          <EventTrackingSubmissionOverTimeCard
            formType={dashboardData.formType}
            rows={dashboardData.submissionRows}
            expandable
            previewRowLimit={EVENT_TRACKING_PREVIEW_ROW_LIMIT}
          />
          <EventTrackingKpiPerformanceCard
            formType={dashboardData.formType}
            segments={dashboardData.kpiSegments}
            expandable
          />
        </div>
      </div>
    </div>
  )
}
