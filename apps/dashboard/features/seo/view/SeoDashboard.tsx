"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { getSeoEmptyDashboardData } from "@/features/seo/controller/seo-empty-data"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import type {
  SeoDashboardData,
  SeoResultRow,
  SeoSortField,
  SeoSortOrder,
} from "@/features/seo/model/seo"
import { SeoResultsTable } from "@/features/seo/view/SeoResultsTable"
import { SeoImportPanel } from "@/features/seo/view/SeoImportPanel"
import { formatSeoSummaryLabel } from "@/features/seo/utils/seo-format"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"

const SEO_REFETCH_MS = 60_000

type SeoDashboardProps = {
  data: SeoDashboardData
  projectId: string
  isActive?: boolean
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
}: SeoDashboardProps) {
  const { dateRangeId, setDateRangeId } = useDashboardDateRange()
  const [dashboardData, setDashboardData] = useState(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [sortBy, setSortBy] = useState<SeoSortField>(initialData.defaultSortBy)
  const [sortOrder, setSortOrder] = useState<SeoSortOrder>(
    initialData.defaultSortOrder
  )

  const fetchSeoForRange = useCallback(
    async (
      rangeId: typeof dateRangeId,
      nextSortBy: SeoSortField,
      nextSortOrder: SeoSortOrder,
      signal?: AbortSignal
    ) => {
      setIsLoading(true)
      const params = new URLSearchParams({
        range_id: rangeId,
        sort_by: nextSortBy,
        sort_order: nextSortOrder,
      })
      const url = `/api/landing-pages/${encodeURIComponent(projectId)}/seo?${params}`

      try {
        const res = await fetch(url, { cache: "no-store", signal })
        if (!res.ok) {
          setDashboardData(getSeoEmptyDashboardData(projectId, rangeId))
          return
        }
        const next = (await res.json()) as SeoDashboardData
        setDashboardData(next)
        setSortBy(next.defaultSortBy)
        setSortOrder(next.defaultSortOrder)
      } catch (err) {
        if (signal?.aborted) return
        setDashboardData(getSeoEmptyDashboardData(projectId, rangeId))
      } finally {
        if (!signal?.aborted) setIsLoading(false)
      }
    },
    [projectId]
  )

  useEffect(() => {
    if (
      dateRangeId === initialData.defaultDateRangeId &&
      sortBy === initialData.defaultSortBy &&
      sortOrder === initialData.defaultSortOrder
    ) {
      setDashboardData(initialData)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    void fetchSeoForRange(dateRangeId, sortBy, sortOrder, controller.signal)
    return () => controller.abort()
  }, [dateRangeId, fetchSeoForRange, initialData, sortBy, sortOrder])

  useEffect(() => {
    if (!isActive) return

    const controller = new AbortController()
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      void fetchSeoForRange(dateRangeId, sortBy, sortOrder, controller.signal)
    }, SEO_REFETCH_MS)

    return () => {
      controller.abort()
      window.clearInterval(id)
    }
  }, [dateRangeId, fetchSeoForRange, isActive, sortBy, sortOrder])

  const sortedRows = useMemo(
    () => sortSeoRows(dashboardData.rows, sortBy, sortOrder),
    [dashboardData.rows, sortBy, sortOrder]
  )

  const summary = formatSeoSummaryLabel(dashboardData.summary)

  const handleSort = (field: SeoSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
      return
    }
    setSortBy(field)
    setSortOrder("desc")
  }

  return (
    <div className="flex flex-col gap-4 px-6 pb-6 lg:px-8">
      <OverviewHeader
        title="SEO"
        dateRangeOptions={dashboardData.dateRangeOptions}
        dateRangeId={dateRangeId}
        onDateRangeChange={setDateRangeId}
      />

      <SeoImportPanel
        projectId={projectId}
        onSynced={() => {
          void fetchSeoForRange(dateRangeId, sortBy, sortOrder)
        }}
      />

      <div
        className={cn(
          "flex flex-col gap-4",
          isLoading && "pointer-events-none opacity-60"
        )}
        aria-busy={isLoading}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Total clicks", value: summary.clicks },
            { label: "Impressions", value: summary.impressions },
            { label: "Avg CTR", value: summary.ctr },
            { label: "Avg position", value: summary.position },
            { label: "Queries", value: summary.queries },
          ].map((kpi) => (
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

        <SeoResultsTable
          rows={sortedRows}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
        />
      </div>
    </div>
  )
}
