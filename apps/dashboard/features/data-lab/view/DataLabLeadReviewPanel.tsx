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
  type DataExportLeadRow,
} from "@/features/data-export/model/data-export"
import { leadHasElevatedRisk } from "@/features/data-lab/model/lead-review"
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

const SCAN_PAGE_SIZE = Math.max(DATA_EXPORT_PAGE_SIZE, 50)
const VIEW_PAGE_SIZE = 50
const MAX_SCAN_PAGES = 40

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString("en-US")
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
  const [elevatedLeads, setElevatedLeads] = useState<DataExportLeadRow[]>([])
  const [scannedLeadTotal, setScannedLeadTotal] = useState(0)
  const [pagesScanned, setPagesScanned] = useState(0)
  const [viewOffset, setViewOffset] = useState(0)
  const [isBlockingLoad, setIsBlockingLoad] = useState(false)
  const [scanComplete, setScanComplete] = useState(false)

  const fetchRawPage = useCallback(
    async (
      offset: number,
      signal?: AbortSignal
    ): Promise<DataExportDashboardData | null> => {
      const url = buildAnalyticsApiPath(
        `/api/landing-pages/${encodeURIComponent(projectId)}/data-export`,
        { rangeId: dateRangeId, customRange, utmFilter, segmentId }
      )
      const withPaging = new URL(url, window.location.origin)
      withPaging.searchParams.set("limit", String(SCAN_PAGE_SIZE))
      withPaging.searchParams.set("offset", String(offset))
      const res = await fetch(withPaging.pathname + withPaging.search, {
        cache: "no-store",
        signal,
      })
      if (!res.ok) return null
      return (await res.json()) as DataExportDashboardData
    },
    [customRange, dateRangeId, projectId, segmentId, utmFilter]
  )

  const loadElevatedLeads = useCallback(
    async (signal?: AbortSignal) => {
      setIsBlockingLoad(true)
      setElevatedLeads([])
      setScannedLeadTotal(0)
      setPagesScanned(0)
      setViewOffset(0)
      setScanComplete(false)

      const found: DataExportLeadRow[] = []
      let offset = 0
      let total = 0
      let pages = 0
      let lastPage: DataExportDashboardData | null = null

      try {
        while (!signal?.aborted && pages < MAX_SCAN_PAGES) {
          const page = await fetchRawPage(offset, signal)
          if (!page) break
          lastPage = page
          total = page.total
          pages += 1
          for (const lead of page.leads) {
            if (leadHasElevatedRisk(lead)) found.push(lead)
          }
          setElevatedLeads([...found])
          setScannedLeadTotal(total)
          setPagesScanned(pages)
          offset += page.limit || SCAN_PAGE_SIZE
          if (offset >= total || page.leads.length === 0) break
        }
        if (lastPage) onDataChange?.(lastPage)
        setScanComplete(true)
      } catch {
        if (signal?.aborted) return
        setElevatedLeads([])
        setScannedLeadTotal(0)
        setScanComplete(true)
      } finally {
        if (!signal?.aborted) setIsBlockingLoad(false)
      }
    },
    [fetchRawPage, onDataChange]
  )

  useEffect(() => {
    if (!isActive || !canAccess) return
    const controller = new AbortController()
    void loadElevatedLeads(controller.signal)
    return () => controller.abort()
  }, [canAccess, isActive, loadElevatedLeads])

  const viewRows = useMemo(
    () => elevatedLeads.slice(viewOffset, viewOffset + VIEW_PAGE_SIZE),
    [elevatedLeads, viewOffset]
  )
  const totalElevated = elevatedLeads.length
  const currentPage =
    totalElevated === 0 ? 1 : Math.floor(viewOffset / VIEW_PAGE_SIZE) + 1
  const totalPages = Math.max(1, Math.ceil(totalElevated / VIEW_PAGE_SIZE) || 1)
  const rangeStart = totalElevated === 0 ? 0 : viewOffset + 1
  const rangeEnd = Math.min(viewOffset + viewRows.length, totalElevated)
  const canGoPrev = viewOffset > 0
  const canGoNext = viewOffset + VIEW_PAGE_SIZE < totalElevated
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
                  ? `Scanning for elevated-risk leads… ${formatCount(totalElevated)} found so far`
                  : totalElevated > 0
                    ? `${formatCount(totalElevated)} elevated-risk sessions — assessments are informational only`
                    : scanComplete
                      ? "No elevated-risk leads in this Data Lab range / UTM / segment"
                      : "Elevated-risk leads only (use Leads table for the full set)"}
              </p>
              {!showLoading && scannedLeadTotal > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Scanned {formatCount(pagesScanned)} page
                  {pagesScanned === 1 ? "" : "s"} (
                  {formatCount(
                    Math.min(pagesScanned * SCAN_PAGE_SIZE, scannedLeadTotal)
                  )}{" "}
                  of {formatCount(scannedLeadTotal)} leads)
                  {pagesScanned >= MAX_SCAN_PAGES &&
                  pagesScanned * SCAN_PAGE_SIZE < scannedLeadTotal
                    ? " — scan capped; narrow the date range if needed"
                    : ""}
                </p>
              ) : null}
            </div>
          </div>
          <p className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {formatCount(totalElevated)} elevated
          </p>
        </CardHeader>
        <CardContent
          className={cn(
            "overflow-hidden p-0",
            showLoading && "pointer-events-none opacity-60"
          )}
        >
          <LeadReviewTable
            rows={viewRows}
            projectId={projectId}
            pageOffset={viewOffset}
            emptyMessage={
              showLoading
                ? "Scanning leads for elevated risk…"
                : initialData?.analyticsUnavailable
                  ? "Lead data is unavailable for this project."
                  : "No elevated-risk leads for the current Data Lab filters. Check the Leads table for all submissions."
            }
          />

          <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {totalElevated === 0
                ? "No elevated-risk entries"
                : `Showing ${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()} of ${totalElevated.toLocaleString()} elevated`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-lg border-neutral-200 bg-white px-2.5 shadow-xs"
                disabled={!canGoPrev || showLoading}
                onClick={() =>
                  setViewOffset((value) => Math.max(0, value - VIEW_PAGE_SIZE))
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
                disabled={!canGoNext || showLoading}
                onClick={() => setViewOffset((value) => value + VIEW_PAGE_SIZE)}
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
