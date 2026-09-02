"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"
import { SegmentsDashboardSkeleton } from "@/features/dashboard/view/dashboard-skeletons"
import { getSegmentsEmptyDashboardData } from "@/features/segments/controller/segments-empty-data"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import type { SegmentsDashboardData } from "@/features/segments/model/segments"
import { SavedSegmentsCard } from "@/features/segments/view/SavedSegmentsCard"
import { SegmentsPerformanceCards } from "@/features/segments/view/SegmentsPerformanceCards"
import { SegmentsSummaryKpiRow } from "@/features/segments/view/SegmentsSummaryKpiRow"
import { CohortRetentionSection } from "@/features/retention/view/CohortRetentionSection"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import { useDashboardPreference } from "@/hooks/use-dashboard-preference"
import { useDashboardQueryParam } from "@/hooks/use-dashboard-query-param"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"
import { useDashboardSegmentFilter } from "@/hooks/use-dashboard-segment-filter"
import type { AnalyticsFetchMode } from "@/lib/dashboard/analytics-fetch-mode"
import {
  buildAnalyticsApiPath,
  shouldUseInitialTabData,
} from "@/lib/dashboard/analytics-query"

const SEGMENTS_REFETCH_MS = 60_000

const PERFORMANCE_VIEWS = [
  { value: "all", label: "All" },
  { value: "performance", label: "Performance" },
  { value: "cohort", label: "Retention" },
  { value: "saved", label: "Saved Segments" },
] as const

type PerformanceView = (typeof PERFORMANCE_VIEWS)[number]["value"]

function parsePerformanceView(raw: string | null | undefined): PerformanceView {
  if (
    raw === "all" ||
    raw === "performance" ||
    raw === "cohort" ||
    raw === "saved"
  ) {
    return raw
  }
  return "all"
}

type SegmentsDashboardProps = {
  data: SegmentsDashboardData
  projectId: string
  isActive?: boolean
  isLoading?: boolean
  allowedViews?: string[] | null
}

function SectionDivider() {
  return (
    <div className="flex items-center gap-3 py-1" role="separator">
      <Separator className="flex-1" />
    </div>
  )
}

export function SegmentsDashboard({
  data: initialData,
  projectId,
  isActive = true,
  isLoading: isTabLoading = false,
  allowedViews = null,
}: SegmentsDashboardProps) {
  const visibleViews = allowedViews
    ? PERFORMANCE_VIEWS.filter((view) => allowedViews.includes(view.value))
    : PERFORMANCE_VIEWS
  const defaultView = visibleViews[0]?.value ?? "all"
  const { dateRangeId, customRange, setDateRangeId, setCustomRange } =
    useDashboardDateRange()
  const { utmFilter } = useDashboardUtmFilter()
  const { segmentId } = useDashboardSegmentFilter()
  const [dashboardData, setDashboardData] = useState(initialData)
  const [isBlockingLoad, setIsBlockingLoad] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeKpiId, setActiveKpiId] = useDashboardPreference(
    projectId,
    "kpi:segments",
    (raw) => raw ?? initialData.summaryKpis[0]?.label ?? ""
  )
  const [view, setView] = useDashboardQueryParam("view", {
    parse: (raw) => {
      const parsed = parsePerformanceView(raw)
      if (allowedViews && !allowedViews.includes(parsed)) {
        return defaultView as PerformanceView
      }
      return parsed
    },
    projectId,
    omitDefault: true,
    refreshOnChange: false,
  })

  const fetchSegmentsForRange = useCallback(
    async (
      rangeId: typeof dateRangeId,
      signal?: AbortSignal,
      mode: AnalyticsFetchMode = "blocking"
    ) => {
      if (mode === "blocking") setIsBlockingLoad(true)
      else setIsRefreshing(true)

      const url = buildAnalyticsApiPath(
        `/api/landing-pages/${encodeURIComponent(projectId)}/segments`,
        { rangeId, customRange, utmFilter, segmentId }
      )
      try {
        const res = await fetch(url, { cache: "no-store", signal })
        if (!res.ok) {
          if (process.env.NODE_ENV === "development") {
            const body = await res.text().catch(() => "")
            console.error(
              `[segments] client fetch ${res.status}`,
              body.slice(0, 200)
            )
          }
          if (mode === "blocking") {
            setDashboardData((prev) =>
              getSegmentsEmptyDashboardData(projectId, rangeId, prev.formType)
            )
          }
          return
        }
        const next = (await res.json()) as SegmentsDashboardData
        setDashboardData(next)
        setActiveKpiId((current) =>
          next.summaryKpis.some((kpi) => kpi.label === current)
            ? current
            : (next.summaryKpis[0]?.label ?? "")
        )
      } catch (err) {
        if (signal?.aborted) return
        if (process.env.NODE_ENV === "development") {
          console.error("[segments] client fetch failed", err)
        }
        if (mode === "blocking") {
          setDashboardData((prev) =>
            getSegmentsEmptyDashboardData(projectId, rangeId, prev.formType)
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
    void fetchSegmentsForRange(dateRangeId, controller.signal, "background")
    return () => controller.abort()
  }, [
    customRange,
    dateRangeId,
    utmFilter,
    segmentId,
    initialData,
    fetchSegmentsForRange,
  ])

  useEffect(() => {
    if (!isActive) return

    const controller = new AbortController()
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      void fetchSegmentsForRange(dateRangeId, controller.signal, "background")
    }, SEGMENTS_REFETCH_MS)

    return () => {
      controller.abort()
      window.clearInterval(id)
    }
  }, [
    customRange,
    dateRangeId,
    utmFilter,
    segmentId,
    fetchSegmentsForRange,
    isActive,
  ])

  const showSkeleton = isTabLoading || isBlockingLoad

  return (
    <div className="flex flex-col gap-4 pb-6">
      <OverviewHeader
        title="Performance"
        projectId={projectId}
        dateRangeOptions={dashboardData.dateRangeOptions}
        dateRangeId={dateRangeId}
        customRange={customRange}
        onDateRangeChange={setDateRangeId}
        onCustomRangeChange={setCustomRange}
      />

      {showSkeleton ? (
        <SegmentsDashboardSkeleton />
      ) : (
        <div
          className={cn(
            "flex flex-col gap-4 transition-opacity",
            isRefreshing && "opacity-80"
          )}
          aria-busy={isRefreshing}
        >
          <Tabs
            value={view}
            onValueChange={(value) => setView(parsePerformanceView(value))}
            className="flex flex-col gap-4"
          >
            <div className="border-b border-neutral-200 bg-transparent">
              <TabsList className="h-auto min-h-10 w-full flex-wrap justify-start gap-x-5 gap-y-1 rounded-none border-0 bg-transparent p-0">
                {visibleViews.map((option) => (
                  <TabsTrigger
                    key={option.value}
                    value={option.value}
                    className="relative -mb-px shrink-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 py-2.5 text-sm font-normal text-neutral-600 shadow-none hover:text-neutral-900 data-[state=active]:border-neutral-950 data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-neutral-950 data-[state=active]:shadow-none"
                  >
                    {option.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="all" className="mt-0 flex flex-col gap-4">
              <SegmentsSummaryKpiRow
                kpis={dashboardData.summaryKpis}
                activeKpiId={activeKpiId}
                onKpiSelect={setActiveKpiId}
              />
              <SegmentsPerformanceCards data={dashboardData} />
              <SectionDivider />
              <CohortRetentionSection projectId={projectId} />
              <SectionDivider />
              <SavedSegmentsCard projectId={projectId} />
            </TabsContent>

            <TabsContent
              value="performance"
              className="mt-0 flex flex-col gap-4"
            >
              <SegmentsSummaryKpiRow
                kpis={dashboardData.summaryKpis}
                activeKpiId={activeKpiId}
                onKpiSelect={setActiveKpiId}
              />
              <SegmentsPerformanceCards data={dashboardData} />
            </TabsContent>

            <TabsContent value="cohort" className="mt-0 flex flex-col gap-4">
              <CohortRetentionSection projectId={projectId} />
            </TabsContent>

            <TabsContent value="saved" className="mt-0 flex flex-col gap-4">
              <SavedSegmentsCard projectId={projectId} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}
