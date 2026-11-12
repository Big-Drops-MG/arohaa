"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Lock, Users } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { getDataExportEmptyDashboardData } from "@/features/data-export/controller/data-export-empty-data"
import {
  DATA_EXPORT_PAGE_SIZE,
  type DataExportDashboardData,
} from "@/features/data-export/model/data-export"
import {
  LEAD_REVIEW_FILTERS,
  matchesLeadReviewFilter,
  summarizeLeadReview,
  type LeadReviewFilterId,
} from "@/features/data-lab/model/lead-review"
import { LeadReviewTable } from "@/features/data-lab/view/LeadReviewTable"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import { useDashboardSegmentFilter } from "@/hooks/use-dashboard-segment-filter"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"
import { buildAnalyticsApiPath } from "@/lib/dashboard/analytics-query"

const REVIEW_PAGE_SIZE = Math.max(DATA_EXPORT_PAGE_SIZE, 50)

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString("en-US")
}

function FilterStat({
  label,
  value,
  hint,
  tone = "default",
  active,
  onClick,
}: {
  label: string
  value: string
  hint?: string
  tone?: "default" | "fraud"
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-full flex-col rounded-xl border px-4 py-3.5 text-left transition-colors",
        active
          ? "border-foreground bg-muted/60 ring-1 ring-foreground/20"
          : "border-border bg-background hover:bg-muted/40",
        tone === "fraud" && !active && "border-rose-200 bg-rose-50/50"
      )}
    >
      <p
        className={cn(
          "text-[11px] font-medium tracking-wide uppercase",
          tone === "fraud" ? "text-rose-800" : "text-muted-foreground"
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tracking-tight tabular-nums",
          tone === "fraud" ? "text-rose-950" : "text-foreground"
        )}
      >
        {value}
      </p>
      {hint ? (
        <p
          className={cn(
            "mt-auto pt-1.5 text-xs leading-relaxed",
            tone === "fraud" ? "text-rose-800/75" : "text-muted-foreground"
          )}
        >
          {hint}
        </p>
      ) : null}
    </button>
  )
}

type DataLabLeadReviewPanelProps = {
  projectId: string
  canAccess: boolean
  data: DataExportDashboardData | null
  isLoading: boolean
  isActive: boolean
  onDataChange?: (data: DataExportDashboardData) => void
}

export function DataLabLeadReviewPanel({
  projectId,
  canAccess,
  data: initialData,
  isLoading: isTabLoading,
  isActive,
  onDataChange,
}: DataLabLeadReviewPanelProps) {
  const { dateRangeId, customRange } = useDashboardDateRange()
  const { utmFilter } = useDashboardUtmFilter()
  const { segmentId } = useDashboardSegmentFilter()
  const [dashboardData, setDashboardData] = useState<DataExportDashboardData>(
    () =>
      initialData ?? {
        ...getDataExportEmptyDashboardData("7d"),
        analyticsUnavailable: true,
      }
  )
  const [pageOffset, setPageOffset] = useState(initialData?.offset ?? 0)
  const [isBlockingLoad, setIsBlockingLoad] = useState(false)
  const [isPageLoading, setIsPageLoading] = useState(false)
  const [filter, setFilter] = useState<LeadReviewFilterId>("all")

  useEffect(() => {
    if (!initialData) return
    setDashboardData(initialData)
    setPageOffset(initialData.offset)
  }, [initialData])

  const fetchPage = useCallback(
    async (
      offset: number,
      signal?: AbortSignal,
      options?: { quiet?: boolean; pageOnly?: boolean }
    ) => {
      const quiet = options?.quiet === true
      const pageOnly = options?.pageOnly === true
      if (pageOnly) setIsPageLoading(true)
      else if (!quiet) setIsBlockingLoad(true)

      const url = buildAnalyticsApiPath(
        `/api/landing-pages/${encodeURIComponent(projectId)}/data-export`,
        { rangeId: dateRangeId, customRange, utmFilter, segmentId }
      )
      const withPaging = new URL(url, window.location.origin)
      withPaging.searchParams.set("limit", String(REVIEW_PAGE_SIZE))
      withPaging.searchParams.set("offset", String(offset))
      try {
        const res = await fetch(withPaging.pathname + withPaging.search, {
          cache: "no-store",
          signal,
        })
        if (!res.ok) {
          if (!quiet) {
            setDashboardData({
              ...getDataExportEmptyDashboardData(dateRangeId),
              analyticsUnavailable: true,
            })
            setPageOffset(0)
          }
          return
        }
        const next = (await res.json()) as DataExportDashboardData
        setDashboardData(next)
        setPageOffset(next.offset)
        onDataChange?.(next)
      } catch {
        if (signal?.aborted) return
        if (!quiet) {
          setDashboardData({
            ...getDataExportEmptyDashboardData(dateRangeId),
            analyticsUnavailable: true,
          })
          setPageOffset(0)
        }
      } finally {
        if (!signal?.aborted) {
          setIsBlockingLoad(false)
          setIsPageLoading(false)
        }
      }
    },
    [customRange, dateRangeId, onDataChange, projectId, segmentId, utmFilter]
  )

  useEffect(() => {
    if (!isActive || !canAccess) return
    const controller = new AbortController()
    void fetchPage(0, controller.signal)
    return () => controller.abort()
  }, [canAccess, fetchPage, isActive])

  const pageStats = useMemo(
    () => summarizeLeadReview(dashboardData.leads),
    [dashboardData.leads]
  )
  const filteredRows = useMemo(
    () =>
      dashboardData.leads.filter((lead) =>
        matchesLeadReviewFilter(lead, filter)
      ),
    [dashboardData.leads, filter]
  )

  const pageSize = dashboardData.limit || REVIEW_PAGE_SIZE
  const total = dashboardData.total
  const currentPage = total === 0 ? 1 : Math.floor(pageOffset / pageSize) + 1
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1)
  const rangeStart = total === 0 ? 0 : pageOffset + 1
  const rangeEnd = Math.min(pageOffset + dashboardData.leads.length, total)
  const canGoPrev = pageOffset > 0 && total > 0
  const canGoNext = pageOffset + pageSize < total
  const showLoading = isTabLoading || isBlockingLoad

  if (!canAccess) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-6 text-center">
        <Lock className="size-5 text-neutral-400" aria-hidden />
        <div>
          <p className="text-sm font-medium text-foreground">
            Lead review is restricted
          </p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Lead review is only available to approved operators.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Review filters
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Uses Data Lab date range, UTM, and segment filters. Counts are for
              the current page.
            </p>
          </div>
          {filter !== "all" ? (
            <button
              type="button"
              className="text-xs font-medium text-sky-700 underline-offset-2 hover:underline"
              onClick={() => setFilter("all")}
            >
              Clear filter
            </button>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {LEAD_REVIEW_FILTERS.map((item) => {
            const value =
              item.id === "all"
                ? pageStats.submissions
                : item.id === "elevated"
                  ? pageStats.elevated
                  : item.id === "incomplete"
                    ? pageStats.incomplete
                    : pageStats.paste
            const hint =
              item.id === "all"
                ? "All leads on this page"
                : item.id === "elevated"
                  ? "Trust below threshold — informational"
                  : item.id === "incomplete"
                    ? "Insufficient signal coverage"
                    : "Leads with paste events"
            return (
              <FilterStat
                key={item.id}
                label={item.label}
                value={formatCount(value)}
                hint={hint}
                tone={"tone" in item ? item.tone : "default"}
                active={filter === item.id}
                onClick={() => setFilter(item.id)}
              />
            )
          })}
        </div>
      </section>

      <Card
        className={cn(
          overviewCardPointerFocusResetClassName,
          overviewAnalyticCardShellClassName,
          "pb-2"
        )}
      >
        <CardHeader
          className={cn(
            overviewAnalyticCardHeaderClassName,
            "justify-between gap-3"
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
              <Users className="size-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <CardTitle className={overviewSectionHeadingClassName}>
                Lead review
              </CardTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {showLoading
                  ? "Loading sessions…"
                  : filteredRows.length > 0
                    ? `${formatCount(filteredRows.length)} sessions on this page — assessments are informational only`
                    : "Trust, paste activity, logs, and session evidence for filtered leads"}
              </p>
            </div>
          </div>
          <p className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {formatCount(total)} total
          </p>
        </CardHeader>
        <CardContent
          className={cn(
            "overflow-hidden p-0",
            (showLoading || isPageLoading) && "pointer-events-none opacity-60"
          )}
        >
          <LeadReviewTable
            rows={filteredRows}
            projectId={projectId}
            pageOffset={pageOffset}
            emptyMessage={
              dashboardData.leads.length === 0
                ? "No leads in this range for the current Data Lab filters."
                : `No leads on this page match the ${filter} filter. Clear the filter or try another page.`
            }
          />

          <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {total === 0
                ? "No entries"
                : `Showing ${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()} of ${total.toLocaleString()}`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-lg border-neutral-200 bg-white px-2.5 shadow-xs"
                disabled={!canGoPrev || isPageLoading || showLoading}
                onClick={() =>
                  void fetchPage(pageOffset - pageSize, undefined, {
                    pageOnly: true,
                  })
                }
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
                Previous
              </Button>
              <span className="min-w-20 text-center text-sm text-muted-foreground tabular-nums">
                {currentPage} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-lg border-neutral-200 bg-white px-2.5 shadow-xs"
                disabled={!canGoNext || isPageLoading || showLoading}
                onClick={() =>
                  void fetchPage(pageOffset + pageSize, undefined, {
                    pageOnly: true,
                  })
                }
                aria-label="Next page"
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
