"use client"

import { useCallback, useEffect, useState } from "react"
import { EventTrackingDashboardSkeleton } from "@/features/dashboard/view/dashboard-skeletons"
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
import { EventTrackingServicesCard } from "@/features/event-tracking/view/EventTrackingServicesCard"
import { EventTrackingSubmissionOverTimeCard } from "@/features/event-tracking/view/EventTrackingSubmissionOverTimeCard"
import {
  hasConversionMetrics,
  hasServiceClickMetrics,
} from "@/features/overview/model/overview"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import { useDashboardPreference } from "@/hooks/use-dashboard-preference"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"
import { useDashboardSegmentFilter } from "@/hooks/use-dashboard-segment-filter"
import type { AnalyticsFetchMode } from "@/lib/dashboard/analytics-fetch-mode"
import {
  buildAnalyticsApiPath,
  shouldUseInitialTabData,
} from "@/lib/dashboard/analytics-query"
import { dashboardGridTwoColClassName } from "@/features/overview/view/overview-card-density"
import { cn } from "@workspace/ui/lib/utils"

const EVENTS_REFETCH_MS = 60_000

type EventTrackingDashboardProps = {
  data: EventTrackingDashboardData
  projectId: string
  isActive?: boolean
  isLoading?: boolean
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
  isLoading: isTabLoading = false,
}: EventTrackingDashboardProps) {
  const { dateRangeId, customRange, setDateRangeId, setCustomRange } =
    useDashboardDateRange()
  const { utmFilter } = useDashboardUtmFilter()
  const { segmentId } = useDashboardSegmentFilter()
  const [dashboardData, setDashboardData] = useState(initialData)
  const [isBlockingLoad, setIsBlockingLoad] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeKpiId, setActiveKpiId] = useDashboardPreference(
    projectId,
    "kpi:event-tracking",
    (raw) => {
      const order = eventTrackingMetricOrder(initialData.formType)
      if (raw && (order as readonly string[]).includes(raw)) {
        return raw as EventTrackingMetricId
      }
      return defaultActiveKpiId(initialData)
    }
  )

  const fetchEventsForRange = useCallback(
    async (
      rangeId: typeof dateRangeId,
      signal?: AbortSignal,
      mode: AnalyticsFetchMode = "blocking"
    ) => {
      if (mode === "blocking") setIsBlockingLoad(true)
      else setIsRefreshing(true)

      const url = buildAnalyticsApiPath(
        `/api/landing-pages/${encodeURIComponent(projectId)}/events`,
        { rangeId, customRange, utmFilter, segmentId }
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
          if (mode === "blocking") {
            setDashboardData((prev) =>
              getEventTrackingEmptyDashboardData(
                projectId,
                rangeId,
                prev.formType
              )
            )
          }
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
        if (mode === "blocking") {
          setDashboardData((prev) =>
            getEventTrackingEmptyDashboardData(
              projectId,
              rangeId,
              prev.formType
            )
          )
        }
      } finally {
        if (!signal?.aborted) {
          if (mode === "blocking") setIsBlockingLoad(false)
          else setIsRefreshing(false)
        }
      }
    },
    [projectId, customRange, utmFilter, segmentId, setActiveKpiId]
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
      setIsBlockingLoad(false)
      return
    }

    const controller = new AbortController()
    void fetchEventsForRange(dateRangeId, controller.signal, "background")
    return () => controller.abort()
  }, [
    customRange,
    dateRangeId,
    utmFilter,
    segmentId,
    initialData,
    fetchEventsForRange,
  ])

  useEffect(() => {
    if (!isActive) return

    const controller = new AbortController()
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      void fetchEventsForRange(dateRangeId, controller.signal, "background")
    }, EVENTS_REFETCH_MS)

    return () => {
      controller.abort()
      window.clearInterval(id)
    }
  }, [
    customRange,
    dateRangeId,
    utmFilter,
    segmentId,
    fetchEventsForRange,
    isActive,
  ])

  return (
    <div className="flex flex-col gap-4 pb-6">
      <OverviewHeader
        title="Event Tracking"
        projectId={projectId}
        dateRangeOptions={dashboardData.dateRangeOptions}
        dateRangeId={dateRangeId}
        customRange={customRange}
        onDateRangeChange={setDateRangeId}
        onCustomRangeChange={setCustomRange}
      />

      {isTabLoading || isBlockingLoad ? (
        <EventTrackingDashboardSkeleton />
      ) : (
        <div
          className={cn(
            "flex flex-col gap-4 transition-opacity",
            isRefreshing && "opacity-80"
          )}
          aria-busy={isRefreshing}
        >
          <EventTrackingKpiRow
            kpis={dashboardData.kpis}
            activeKpiId={activeKpiId}
            onKpiSelect={setActiveKpiId}
          />

          <div className={dashboardGridTwoColClassName}>
            {hasConversionMetrics(dashboardData.formType) ? (
              <EventTrackingSubmissionOverTimeCard
                formType={dashboardData.formType}
                rows={dashboardData.submissionRows}
                expandable
                previewRowLimit={EVENT_TRACKING_PREVIEW_ROW_LIMIT}
              />
            ) : null}
            <EventTrackingKpiPerformanceCard
              formType={dashboardData.formType}
              segments={dashboardData.kpiSegments}
              expandable
            />
          </div>

          {hasServiceClickMetrics(dashboardData.formType) ? (
            <EventTrackingServicesCard rows={dashboardData.serviceRows} />
          ) : null}
        </div>
      )}
    </div>
  )
}
