"use client"

import { useEffect, useMemo, useState } from "react"
import { Download, Info } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import {
  overviewAnalyticCardContentPaddingClassName,
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"
import {
  overviewSelectContentClassName,
  overviewSelectItemClassName,
  overviewSelectTriggerClassName,
} from "@/features/overview/view/overview-select-styles"
import { ChannelRetentionInsightTable } from "@/features/retention/view/ChannelRetentionInsightTable"
import { CohortRetentionGrid } from "@/features/retention/view/CohortRetentionGrid"
import {
  exportChannelRetentionCsv,
  exportRetentionCsv,
} from "@/features/retention/utils/export-csv"
import { useDashboardAccess } from "@/features/dashboard/view/dashboard-access-context"
import {
  buildChannelRetentionSummary,
  buildRetentionMatrix,
  type CohortRetentionRow,
  type RetentionSplitBy,
} from "@/features/retention/utils/retention-matrix"
import { useDashboardSegmentFilter } from "@/hooks/use-dashboard-segment-filter"
import { trafficBreakdownCardShellClassName } from "@/features/traffic/view/traffic-card-layout"

const MAX_WEEKS = 8

type Props = {
  projectId: string
}

function retentionHelpText(splitBy: RetentionSplitBy): string {
  switch (splitBy) {
    case "utm_id":
      return "Compare return rates by UTM ID. Each ID is typically one visitor — use W1/W4/W8 and expand a row for the full cohort curve."
    case "utm_source":
      return "Compare how often visitors from each traffic source return in the weeks after their first visit."
    case "utm_campaign":
      return "Compare how often visitors from each campaign return in the weeks after their first visit."
    default:
      return "How often visitors return in the weeks after their first visit."
  }
}

export function CohortRetentionSection({ projectId }: Props) {
  const { segmentId } = useDashboardSegmentFilter()
  const { readOnly } = useDashboardAccess()
  const [splitBy, setSplitBy] = useState<RetentionSplitBy>("none")
  const [rows, setRows] = useState<CohortRetentionRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const matrix = useMemo(() => buildRetentionMatrix(rows, MAX_WEEKS), [rows])
  const channelSummaries = useMemo(
    () =>
      splitBy === "none" ? [] : buildChannelRetentionSummary(rows, MAX_WEEKS),
    [rows, splitBy]
  )

  const canExport =
    !readOnly &&
    !isLoading &&
    (splitBy === "none" ? matrix.length > 0 : channelSummaries.length > 0)

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (segmentId) params.set("segment_id", segmentId)
    if (splitBy !== "none") params.set("split_by", splitBy)

    const qs = params.toString()
    const url = `/api/landing-pages/${encodeURIComponent(projectId)}/cohorts${qs ? `?${qs}` : ""}`

    void fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text().catch(() => "")
          throw new Error(body || `Failed (${res.status})`)
        }
        return res.json() as Promise<CohortRetentionRow[]>
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setRows(Array.isArray(data) ? data : [])
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : "Failed to load cohorts")
        setRows([])
        setIsLoading(false)
      })

    return () => controller.abort()
  }, [projectId, segmentId, splitBy])

  return (
    <Card
      className={cn(
        overviewCardPointerFocusResetClassName,
        overviewAnalyticCardShellClassName,
        trafficBreakdownCardShellClassName
      )}
    >
      <CardHeader
        className={cn(
          overviewAnalyticCardHeaderClassName,
          "flex-row flex-wrap items-center justify-between gap-3"
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <CardTitle className={overviewSectionHeadingClassName}>
            Retention
          </CardTitle>
          <div className="group relative inline-flex">
            <button
              type="button"
              aria-label="About retention"
              className="inline-flex size-5 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-neutral-900/15 focus-visible:outline-none"
            >
              <Info className="size-3.5" aria-hidden />
            </button>
            <div
              role="tooltip"
              className="pointer-events-none absolute top-full left-0 z-50 mt-2 w-72 max-w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-neutral-200 bg-neutral-950 px-3.5 py-3 text-left text-xs leading-relaxed text-white opacity-0 shadow-lg transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
            >
              {retentionHelpText(splitBy)}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={splitBy}
            onValueChange={(value) => setSplitBy(value as RetentionSplitBy)}
          >
            <SelectTrigger
              aria-label="Split retention by channel"
              className={cn(overviewSelectTriggerClassName, "h-8 w-[180px]")}
            >
              <SelectValue placeholder="All traffic" />
            </SelectTrigger>
            <SelectContent className={overviewSelectContentClassName}>
              <SelectItem value="none" className={overviewSelectItemClassName}>
                All traffic
              </SelectItem>
              <SelectItem
                value="utm_id"
                className={overviewSelectItemClassName}
              >
                By utm_id
              </SelectItem>
              <SelectItem
                value="utm_source"
                className={overviewSelectItemClassName}
              >
                By utm_source
              </SelectItem>
              <SelectItem
                value="utm_campaign"
                className={overviewSelectItemClassName}
              >
                By utm_campaign
              </SelectItem>
            </SelectContent>
          </Select>
          {!readOnly ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg border-neutral-200 bg-white shadow-xs"
              disabled={!canExport}
              onClick={() => {
                if (splitBy === "none") {
                  exportRetentionCsv(matrix, MAX_WEEKS)
                  return
                }
                exportChannelRetentionCsv(channelSummaries, splitBy)
              }}
            >
              <Download className="size-3.5" />
              Export CSV
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent
        className={cn(
          overviewAnalyticCardContentPaddingClassName,
          "flex min-h-0 flex-col pt-0 pb-4"
        )}
      >
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-8 text-center text-sm text-destructive">
            {error}
          </div>
        ) : isLoading ? (
          <div className="px-1 py-10 text-center text-sm text-muted-foreground">
            Loading retention…
          </div>
        ) : splitBy === "none" ? (
          <CohortRetentionGrid data={rows} maxWeeks={MAX_WEEKS} />
        ) : (
          <ChannelRetentionInsightTable
            data={rows}
            splitBy={splitBy}
            maxWeeks={MAX_WEEKS}
          />
        )}
      </CardContent>
    </Card>
  )
}
