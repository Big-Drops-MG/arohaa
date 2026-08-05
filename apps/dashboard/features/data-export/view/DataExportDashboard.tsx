"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { getDataExportEmptyDashboardData } from "@/features/data-export/controller/data-export-empty-data"
import type { DataExportDashboardData } from "@/features/data-export/model/data-export"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import {
  buildAnalyticsApiPath,
  shouldUseInitialTabData,
} from "@/lib/dashboard/analytics-query"

type DataExportDashboardProps = {
  data: DataExportDashboardData
  projectId: string
  isActive?: boolean
  isLoading?: boolean
}

function formatWhen(value: string): string {
  const d = new Date(
    value.includes("T") ? value : value.replace(" ", "T") + "Z"
  )
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

export function DataExportDashboard({
  data: initialData,
  projectId,
  isActive = true,
  isLoading: isTabLoading = false,
}: DataExportDashboardProps) {
  const { dateRangeId, customRange, setDateRangeId, setCustomRange } =
    useDashboardDateRange()
  const [dashboardData, setDashboardData] = useState(initialData)
  const [isBlockingLoad, setIsBlockingLoad] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const fieldKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const lead of dashboardData.leads) {
      for (const key of Object.keys(lead.fields)) keys.add(key)
    }
    return [...keys].sort((a, b) => a.localeCompare(b)).slice(0, 12)
  }, [dashboardData.leads])

  const fetchPage = useCallback(
    async (offset: number, append: boolean, signal?: AbortSignal) => {
      if (append) setLoadingMore(true)
      else setIsBlockingLoad(true)
      const url = buildAnalyticsApiPath(
        `/api/landing-pages/${encodeURIComponent(projectId)}/data-export`,
        { rangeId: dateRangeId, customRange }
      )
      const withPaging = new URL(url, window.location.origin)
      withPaging.searchParams.set("limit", "15")
      withPaging.searchParams.set("offset", String(offset))
      try {
        const res = await fetch(withPaging.pathname + withPaging.search, {
          cache: "no-store",
          signal,
        })
        if (!res.ok) {
          if (!append) {
            setDashboardData(
              getDataExportEmptyDashboardData(
                dateRangeId,
                dashboardData.hasRedirect
              )
            )
          }
          return
        }
        const next = (await res.json()) as DataExportDashboardData
        setDashboardData((prev) =>
          append
            ? {
                ...next,
                leads: [...prev.leads, ...next.leads],
                offset: next.offset,
                hasMore: next.hasMore,
                total: next.total,
              }
            : next
        )
      } catch {
        if (signal?.aborted) return
        if (!append) {
          setDashboardData(
            getDataExportEmptyDashboardData(
              dateRangeId,
              dashboardData.hasRedirect
            )
          )
        }
      } finally {
        if (!signal?.aborted) {
          setIsBlockingLoad(false)
          setLoadingMore(false)
        }
      }
    },
    [customRange, dashboardData.hasRedirect, dateRangeId, projectId]
  )

  useEffect(() => {
    if (!isActive) return
    if (
      shouldUseInitialTabData(
        dateRangeId,
        initialData.defaultDateRangeId,
        undefined,
        customRange
      )
    ) {
      setDashboardData(initialData)
      return
    }
    const controller = new AbortController()
    void fetchPage(0, false, controller.signal)
    return () => controller.abort()
  }, [customRange, dateRangeId, fetchPage, initialData, isActive])

  if (isTabLoading || isBlockingLoad) {
    return (
      <div className="space-y-4">
        <OverviewHeader
          title="Data Export"
          helpContent="Captured offer-form details for this landing page."
          dateRangeId={dateRangeId}
          onDateRangeChange={setDateRangeId}
          customRange={customRange}
          onCustomRangeChange={setCustomRange}
          dateRangeOptions={dashboardData.dateRangeOptions}
        />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  if (!dashboardData.hasRedirect) {
    return (
      <div className="space-y-4">
        <OverviewHeader
          title="Data Export"
          helpContent="Captured offer-form details for this landing page."
          dateRangeId={dateRangeId}
          onDateRangeChange={setDateRangeId}
          customRange={customRange}
          onCustomRangeChange={setCustomRange}
          dateRangeOptions={dashboardData.dateRangeOptions}
        />
        <p className="text-sm text-muted-foreground">
          Set an Offer / redirect page URL in Settings (Zip form type) to start
          capturing offer-form details.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <OverviewHeader
        title="Data Export"
        helpContent="Captured offer-form details for this landing page."
        dateRangeId={dateRangeId}
        onDateRangeChange={setDateRangeId}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
        dateRangeOptions={dashboardData.dateRangeOptions}
      />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Zip</th>
              {fieldKeys.map((key) => (
                <th key={key} className="px-3 py-2 font-medium">
                  {key}
                </th>
              ))}
              <th className="px-3 py-2 font-medium">Session</th>
            </tr>
          </thead>
          <tbody>
            {dashboardData.leads.length === 0 ? (
              <tr>
                <td
                  className="px-3 py-6 text-muted-foreground"
                  colSpan={3 + fieldKeys.length}
                >
                  No captured rows for this range yet.
                </td>
              </tr>
            ) : (
              dashboardData.leads.map((lead) => (
                <tr
                  key={`${lead.sessionId}-${lead.createdAt}`}
                  className="border-b"
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatWhen(lead.createdAt)}
                  </td>
                  <td className="px-3 py-2">{lead.zip || "—"}</td>
                  {fieldKeys.map((key) => (
                    <td key={key} className="max-w-[14rem] truncate px-3 py-2">
                      {lead.fields[key] || "—"}
                    </td>
                  ))}
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {lead.sessionId.slice(0, 8)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {dashboardData.hasMore ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loadingMore}
          onClick={() => void fetchPage(dashboardData.leads.length, true)}
        >
          {loadingMore ? "Loading..." : "Show 15 more"}
        </Button>
      ) : null}
    </div>
  )
}
