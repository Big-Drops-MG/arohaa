"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AtSign, Lock } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import type { UtmSourceTrustRow } from "@/features/data-lab/model/utm-source-trust"
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

const thClassName =
  "px-4 py-3 text-right text-xs font-semibold tracking-wide whitespace-nowrap text-muted-foreground"
const tdClassName = "px-4 py-3 text-right text-sm tabular-nums text-foreground"

function pct(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return "0%"
  return `${Math.round(rate * 1000) / 10}%`
}

function reputationLabel(status: UtmSourceTrustRow["reputation"]): string {
  if (status === "location_mismatch_cluster") return "Cluster"
  if (status === "clean") return "Clean"
  return "—"
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US")
}

type DataLabUtmSourceTrustPanelProps = {
  projectId: string
  canAccess: boolean
  isActive: boolean
}

export function DataLabUtmSourceTrustPanel({
  projectId,
  canAccess,
  isActive,
}: DataLabUtmSourceTrustPanelProps) {
  const { dateRangeId, customRange } = useDashboardDateRange()
  const { utmFilter } = useDashboardUtmFilter()
  const { segmentId } = useDashboardSegmentFilter()
  const requestPath = useMemo(
    () =>
      buildAnalyticsApiPath(
        `/api/landing-pages/${encodeURIComponent(projectId)}/source-trust`,
        {
          rangeId: dateRangeId,
          customRange,
          utmFilter,
          segmentId,
        }
      ),
    [customRange, dateRangeId, projectId, segmentId, utmFilter]
  )

  const [rows, setRows] = useState<UtmSourceTrustRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadRows = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(requestPath, {
          cache: "no-store",
          signal,
        })
        if (!res.ok) {
          throw new Error(`source-trust ${res.status}`)
        }
        const json = (await res.json()) as { sources?: UtmSourceTrustRow[] }
        if (signal?.aborted) return
        setRows(json.sources ?? [])
      } catch (err) {
        if (signal?.aborted) return
        if (err instanceof Error && err.name === "AbortError") return
        setError("Failed to load source trust.")
        setRows([])
      } finally {
        if (!signal?.aborted) setIsLoading(false)
      }
    },
    [requestPath]
  )

  useEffect(() => {
    if (!isActive || !canAccess) return
    const controller = new AbortController()
    void loadRows(controller.signal)
    return () => controller.abort()
  }, [canAccess, isActive, loadRows])

  if (!canAccess) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-6 text-center">
        <Lock className="size-5 text-neutral-400" aria-hidden />
        <div>
          <p className="text-sm font-medium text-foreground">
            Source trust is restricted
          </p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            UTM source trust is only available to approved operators.
          </p>
        </div>
      </div>
    )
  }

  return (
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
            <AtSign className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <CardTitle className={overviewSectionHeadingClassName}>
              Source trust
            </CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Per-source trust and ZIP/IP location mismatch for this landing
              page with the current Data Lab date range, UTM, and segment
              filters. Cluster uses the 7d and 30d mismatch rate (≥50%, n≥10).
            </p>
          </div>
        </div>
        <p className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {formatCount(rows.length)} sources
        </p>
      </CardHeader>
      <CardContent
        className={cn(
          "overflow-hidden p-0",
          isLoading && "pointer-events-none opacity-60"
        )}
      >
        {error ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {error}
          </p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {isLoading
              ? "Loading source trust…"
              : "No sources in this Data Lab range yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-max min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className={cn(thClassName, "text-left")}>Source</th>
                  <th className={thClassName}>Trust 7d</th>
                  <th className={thClassName}>Trust 30d</th>
                  <th className={thClassName}>Status 7d</th>
                  <th className={thClassName}>Status 30d</th>
                  <th className={thClassName}>Leads</th>
                  <th className={thClassName}>7d</th>
                  <th className={thClassName}>30d</th>
                  <th className={thClassName}>Mismatch</th>
                  <th className={thClassName}>7d mm</th>
                  <th className={thClassName}>30d mm</th>
                  <th className={thClassName}>7d %</th>
                  <th className={thClassName}>30d %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.utmSource}
                    className="border-b border-border last:border-b-0 hover:bg-muted/20"
                  >
                    <td
                      className={cn(
                        tdClassName,
                        "max-w-[16rem] text-left font-medium whitespace-normal"
                      )}
                    >
                      {row.utmSource}
                    </td>
                    <td className={tdClassName}>
                      {row.trustScore7d == null ? "—" : row.trustScore7d}
                    </td>
                    <td className={tdClassName}>
                      {row.trustScore30d == null ? "—" : row.trustScore30d}
                    </td>
                    <td
                      className={cn(
                        tdClassName,
                        row.reputation7d === "location_mismatch_cluster"
                          ? "font-medium text-rose-700"
                          : "text-muted-foreground"
                      )}
                    >
                      {reputationLabel(row.reputation7d)}
                    </td>
                    <td
                      className={cn(
                        tdClassName,
                        row.reputation30d === "location_mismatch_cluster"
                          ? "font-medium text-rose-700"
                          : "text-muted-foreground"
                      )}
                    >
                      {reputationLabel(row.reputation30d)}
                    </td>
                    <td className={tdClassName}>{row.leadsTotal}</td>
                    <td className={tdClassName}>{row.leads7d}</td>
                    <td className={tdClassName}>{row.leads30d}</td>
                    <td className={tdClassName}>{row.mismatchTotal}</td>
                    <td className={tdClassName}>{row.mismatch7d}</td>
                    <td className={tdClassName}>{row.mismatch30d}</td>
                    <td className={tdClassName}>{pct(row.mismatchRate7d)}</td>
                    <td className={tdClassName}>{pct(row.mismatchRate30d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
