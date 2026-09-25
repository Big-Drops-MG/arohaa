"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { SeoDashboardSkeleton } from "@/features/dashboard/view/dashboard-skeletons"
import { getSeoEmptyDashboardData } from "@/features/seo/controller/seo-empty-data"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import type {
  SeoDashboardData,
  SeoResultRow,
  SeoSortField,
  SeoSortOrder,
} from "@/features/seo/model/seo"
import { SeoResultsTable } from "@/features/seo/view/SeoResultsTable"
import { SeoConnectPanel } from "@/features/seo/view/SeoConnectPanel"
import { SeoContentPanel } from "@/features/seo/view/SeoContentPanel"
import { formatSeoSummaryLabel } from "@/features/seo/utils/seo-format"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import { useDashboardQueryParam } from "@/hooks/use-dashboard-query-param"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"
import type { AnalyticsFetchMode } from "@/lib/dashboard/analytics-fetch-mode"
import {
  buildAnalyticsApiPath,
  shouldUseInitialTabData,
} from "@/lib/dashboard/analytics-query"
import { cn } from "@workspace/ui/lib/utils"

const SEO_REFETCH_MS = 60_000

type SeoDashboardProps = {
  data: SeoDashboardData
  projectId: string
  isActive?: boolean
  isLoading?: boolean
}

function sortSeoRows(
  rows: SeoResultRow[],
  sortBy: SeoSortField,
  sortOrder: SeoSortOrder
): SeoResultRow[] {
  const dir = sortOrder === "asc" ? 1 : -1
  return [...rows].sort((a, b) => {
    if (sortBy === "query") {
      return a.query.localeCompare(b.query) * dir
    }
    const av = a[sortBy]
    const bv = b[sortBy]
    if (av === bv) return 0
    return av > bv ? dir : -dir
  })
}

export function SeoDashboard({
  data: initialData,
  projectId,
  isActive = true,
  isLoading: isTabLoading = false,
}: SeoDashboardProps) {
  const { dateRangeId, customRange, setDateRangeId, setCustomRange } =
    useDashboardDateRange()
  const { utmFilter } = useDashboardUtmFilter()
  const [dashboardData, setDashboardData] = useState(initialData)
  const [isBlockingLoad, setIsBlockingLoad] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [sortBy, setSortBy] = useDashboardQueryParam("sort_by", {
    parse: (raw) => {
      const allowed: SeoSortField[] = [
        "clicks",
        "impressions",
        "ctr",
        "position",
        "query",
      ]
      return allowed.includes(raw as SeoSortField)
        ? (raw as SeoSortField)
        : initialData.defaultSortBy
    },
    projectId,
    omitDefault: true,
  })
  const [sortOrder, setSortOrder] = useDashboardQueryParam("sort_order", {
    parse: (raw) =>
      raw === "asc" || raw === "desc" ? raw : initialData.defaultSortOrder,
    projectId,
    omitDefault: true,
  })

  const fetchSeoForRange = useCallback(
    async (
      rangeId: typeof dateRangeId,
      nextSortBy: SeoSortField,
      nextSortOrder: SeoSortOrder,
      signal?: AbortSignal,
      mode: AnalyticsFetchMode = "blocking"
    ) => {
      if (mode === "blocking") setIsBlockingLoad(true)
      else setIsRefreshing(true)
      const url = buildAnalyticsApiPath(
        `/api/landing-pages/${encodeURIComponent(projectId)}/seo`,
        {
          rangeId,
          customRange,
          utmFilter,
          extra: {
            sort_by: nextSortBy,
            sort_order: nextSortOrder,
          },
        }
      )

      try {
        const res = await fetch(url, { cache: "no-store", signal })
        if (!res.ok) {
          if (mode === "blocking") {
            setDashboardData(getSeoEmptyDashboardData(projectId, rangeId))
          }
          return
        }
        const next = (await res.json()) as SeoDashboardData
        setDashboardData(next)
      } catch {
        if (signal?.aborted) return
        if (mode === "blocking") {
          setDashboardData(getSeoEmptyDashboardData(projectId, rangeId))
        }
      } finally {
        if (!signal?.aborted) {
          if (mode === "blocking") setIsBlockingLoad(false)
          else setIsRefreshing(false)
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
      ) &&
      sortBy === initialData.defaultSortBy &&
      sortOrder === initialData.defaultSortOrder
    ) {
      setDashboardData(initialData)
      setIsBlockingLoad(false)
      return
    }

    const controller = new AbortController()
    void fetchSeoForRange(
      dateRangeId,
      sortBy,
      sortOrder,
      controller.signal,
      "background"
    )
    return () => controller.abort()
  }, [
    customRange,
    dateRangeId,
    utmFilter,
    fetchSeoForRange,
    initialData,
    sortBy,
    sortOrder,
  ])

  useEffect(() => {
    if (!isActive) return

    const controller = new AbortController()
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      void fetchSeoForRange(
        dateRangeId,
        sortBy,
        sortOrder,
        controller.signal,
        "background"
      )
    }, SEO_REFETCH_MS)

    return () => {
      controller.abort()
      window.clearInterval(id)
    }
  }, [customRange, dateRangeId, fetchSeoForRange, isActive, sortBy, sortOrder])

  const sortedRows = useMemo(
    () => sortSeoRows(dashboardData.rows, sortBy, sortOrder),
    [dashboardData.rows, sortBy, sortOrder]
  )

  const summary = formatSeoSummaryLabel(dashboardData.summary)
  const isOrganic = dashboardData.source === "organic"

  const handleSort = (field: SeoSortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
      return
    }
    setSortBy(field)
    setSortOrder("desc")
  }

  const refresh = () => {
    void fetchSeoForRange(
      dateRangeId,
      sortBy,
      sortOrder,
      undefined,
      "background"
    )
  }

  const handleGscChanged = () => {
    // Search Console data is delayed (often 2–3 days). After sync, widen off
    // "Today"/"Yesterday" so newly imported rows are visible immediately.
    if (dateRangeId === "today" || dateRangeId === "yesterday") {
      setDateRangeId("7d")
      return
    }
    refresh()
  }

  const kpis = isOrganic
    ? [
        { label: "Google sessions", value: summary.clicks },
        { label: "Page views", value: summary.impressions },
        { label: "Landing paths", value: summary.queries },
      ]
    : [
        { label: "Total clicks", value: summary.clicks },
        { label: "Impressions", value: summary.impressions },
        { label: "Avg CTR", value: summary.ctr },
        { label: "Avg position", value: summary.position },
        { label: "Queries", value: summary.queries },
      ]

  return (
    <div className="flex flex-col gap-4 pb-6">
      <OverviewHeader
        title="SEO"
        projectId={projectId}
        dateRangeOptions={dashboardData.dateRangeOptions}
        dateRangeId={dateRangeId}
        customRange={customRange}
        onDateRangeChange={setDateRangeId}
        onCustomRangeChange={setCustomRange}
      />

      <SeoConnectPanel
        projectId={projectId}
        source={dashboardData.source}
        gsc={dashboardData.gsc}
        onChanged={handleGscChanged}
      />

      {isTabLoading || isBlockingLoad ? (
        <SeoDashboardSkeleton />
      ) : (
        <div
          className={cn(
            "flex flex-col gap-4 transition-opacity",
            isRefreshing && "opacity-80"
          )}
          aria-busy={isRefreshing}
        >
          <div
            className={cn(
              "grid gap-3 sm:grid-cols-2",
              isOrganic ? "lg:grid-cols-3" : "lg:grid-cols-5"
            )}
          >
            {kpis.map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl border border-border bg-white px-4 py-3"
              >
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="mt-1 text-xl font-semibold text-foreground tabular-nums">
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>

          <SeoContentPanel
            items={dashboardData.content ?? []}
            metricLabel={isOrganic ? "Sessions" : "Clicks"}
          />

          <SeoResultsTable
            rows={sortedRows}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            source={dashboardData.source}
          />
        </div>
      )}
    </div>
  )
}
