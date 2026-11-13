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
import type { DataExportLeadRow } from "@/features/data-export/model/data-export"
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

const VIEW_PAGE_SIZE = 50

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString("en-US")
}

type DataLabLeadReviewPanelProps = {
  projectId: string
  canAccess: boolean
  isActive: boolean
}

export function DataLabLeadReviewPanel({
  projectId,
  canAccess,
  isActive,
}: DataLabLeadReviewPanelProps) {
  const { dateRangeId, customRange } = useDashboardDateRange()
  const { utmFilter } = useDashboardUtmFilter()
  const { segmentId } = useDashboardSegmentFilter()
  const [elevatedLeads, setElevatedLeads] = useState<DataExportLeadRow[]>([])
  const [totalElevated, setTotalElevated] = useState(0)
  const [viewOffset, setViewOffset] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filterKey = useMemo(
    () =>
      buildAnalyticsApiPath(
        `/api/landing-pages/${encodeURIComponent(projectId)}/elevated-leads`,
        {
          rangeId: dateRangeId,
          customRange,
          utmFilter,
          segmentId,
        }
      ),
    [customRange, dateRangeId, projectId, segmentId, utmFilter]
  )

  useEffect(() => {
    setViewOffset(0)
  }, [filterKey])

  const loadPage = useCallback(
    async (offset: number, signal?: AbortSignal) => {
      setIsLoading(true)
      setError(null)
      try {
        const path = buildAnalyticsApiPath(
          `/api/landing-pages/${encodeURIComponent(projectId)}/elevated-leads`,
          {
            rangeId: dateRangeId,
            customRange,
            utmFilter,
            segmentId,
            extra: {
              limit: String(VIEW_PAGE_SIZE),
              offset: String(offset),
            },
          }
        )
        const res = await fetch(path, { cache: "no-store", signal })
        if (!res.ok) throw new Error(`elevated-leads ${res.status}`)
        const json = (await res.json()) as {
          leads?: DataExportLeadRow[]
          total?: number
        }
        if (signal?.aborted) return
        setElevatedLeads(json.leads ?? [])
        setTotalElevated(Number(json.total ?? 0) || 0)
      } catch (err) {
        if (signal?.aborted) return
        if (err instanceof Error && err.name === "AbortError") return
        setError("Failed to load elevated-risk leads.")
        setElevatedLeads([])
        setTotalElevated(0)
      } finally {
        if (!signal?.aborted) setIsLoading(false)
      }
    },
    [customRange, dateRangeId, projectId, segmentId, utmFilter]
  )

  useEffect(() => {
    if (!isActive || !canAccess) return
    const controller = new AbortController()
    void loadPage(viewOffset, controller.signal)
    return () => controller.abort()
  }, [canAccess, isActive, loadPage, viewOffset])

  const currentPage =
    totalElevated === 0 ? 1 : Math.floor(viewOffset / VIEW_PAGE_SIZE) + 1
  const totalPages = Math.max(1, Math.ceil(totalElevated / VIEW_PAGE_SIZE) || 1)
  const rangeStart = totalElevated === 0 ? 0 : viewOffset + 1
  const rangeEnd = Math.min(viewOffset + elevatedLeads.length, totalElevated)
  const canGoPrev = viewOffset > 0
  const canGoNext = viewOffset + VIEW_PAGE_SIZE < totalElevated

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
                {isLoading
                  ? "Loading elevated-risk leads…"
                  : error
                    ? error
                    : totalElevated > 0
                      ? `${formatCount(totalElevated)} elevated-risk sessions — assessments are informational only`
                      : "No elevated-risk leads in this Data Lab range / UTM / segment"}
              </p>
            </div>
          </div>
          <p className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {formatCount(totalElevated)} elevated
          </p>
        </CardHeader>
        <CardContent
          className={cn(
            "overflow-hidden p-0",
            isLoading && "pointer-events-none opacity-60"
          )}
        >
          <LeadReviewTable
            rows={elevatedLeads}
            projectId={projectId}
            pageOffset={viewOffset}
            emptyMessage={
              isLoading
                ? "Loading elevated-risk leads…"
                : error
                  ? error
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
                disabled={!canGoPrev || isLoading}
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
                disabled={!canGoNext || isLoading}
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
