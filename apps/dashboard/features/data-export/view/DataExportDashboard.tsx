"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { getDataExportEmptyDashboardData } from "@/features/data-export/controller/data-export-empty-data"
import type { DataExportDashboardData } from "@/features/data-export/model/data-export"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import {
  buildAnalyticsApiPath,
  shouldUseInitialTabData,
} from "@/lib/dashboard/analytics-query"
import {
  formatInDashboardTimezone,
  getDashboardTimezoneAbbreviation,
} from "@/lib/datetime"

type DataExportDashboardProps = {
  data: DataExportDashboardData
  projectId: string
  isActive?: boolean
  isLoading?: boolean
}

const PREFERRED_FIELD_ORDER = [
  "dob",
  "first_name",
  "last_name",
  "address",
  "city",
  "state",
]

const thClassName =
  "px-5 py-2.5 text-left text-xs font-semibold whitespace-nowrap text-muted-foreground sm:px-6"

const tdClassName = "px-5 py-3 align-top text-sm text-foreground sm:px-6"

function formatWhen(value: string): string {
  const d = new Date(
    value.includes("T") ? value : value.replace(" ", "T") + "Z"
  )
  if (Number.isNaN(d.getTime())) return value
  const formatted = formatInDashboardTimezone(d, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
  return `${formatted} ${getDashboardTimezoneAbbreviation(d)}`
}

function sortFieldKeys(keys: string[]): string[] {
  const preferred = new Map(
    PREFERRED_FIELD_ORDER.map((key, index) => [key, index])
  )
  return [...keys].sort((a, b) => {
    const ai = preferred.get(a.toLowerCase())
    const bi = preferred.get(b.toLowerCase())
    if (ai != null && bi != null) return ai - bi
    if (ai != null) return -1
    if (bi != null) return 1
    return a.localeCompare(b)
  })
}

function isAddressFieldKey(key: string): boolean {
  return /^address(_line_?[12])?$/i.test(key.trim())
}

function cellValue(value: string | undefined): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : "—"
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
    return sortFieldKeys([...keys])
  }, [dashboardData.leads])

  const fetchPage = useCallback(
    async (
      offset: number,
      append: boolean,
      signal?: AbortSignal,
      options?: { quiet?: boolean }
    ) => {
      const quiet = options?.quiet === true
      if (append) setLoadingMore(true)
      else if (!quiet) setIsBlockingLoad(true)
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
          if (!append && !quiet) {
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
        if (!append && !quiet) {
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

  useEffect(() => {
    if (!isActive || !dashboardData.hasRedirect) return
    const controller = new AbortController()
    const id = setInterval(() => {
      void fetchPage(0, false, controller.signal, { quiet: true })
    }, 15_000)
    return () => {
      clearInterval(id)
      controller.abort()
    }
  }, [dashboardData.hasRedirect, fetchPage, isActive])

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
        <div className="h-40 animate-pulse rounded-xl border border-border bg-muted/40" />
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
        <Card
          className={cn(
            overviewCardPointerFocusResetClassName,
            overviewAnalyticCardShellClassName
          )}
        >
          <CardContent className="px-5 py-8 sm:px-6">
            <p className="text-sm text-muted-foreground">
              Set an Offer / redirect page URL in Settings (Zip form type) to
              start capturing offer-form details.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const colCount = 8 + fieldKeys.length

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

      <Card
        className={cn(
          overviewCardPointerFocusResetClassName,
          overviewAnalyticCardShellClassName,
          "pb-2"
        )}
      >
        <CardHeader className={overviewAnalyticCardHeaderClassName}>
          <CardTitle className={overviewSectionHeadingClassName}>
            Captured leads
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-hidden p-0 pb-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[64rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className={thClassName}>#</th>
                  <th className={thClassName}>When</th>
                  <th className={thClassName}>Zip</th>
                  <th className={thClassName}>Email</th>
                  <th className={thClassName}>utm_source</th>
                  <th className={thClassName}>utm_id</th>
                  <th className={thClassName}>Form Submitted</th>
                  {fieldKeys.map((key) => (
                    <th key={key} className={thClassName}>
                      {key}
                    </th>
                  ))}
                  <th className={thClassName}>Session</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.leads.length === 0 ? (
                  <tr>
                    <td
                      className="px-5 py-10 text-center text-sm text-muted-foreground sm:px-6"
                      colSpan={colCount}
                    >
                      No captured rows for this range yet.
                    </td>
                  </tr>
                ) : (
                  dashboardData.leads.map((lead, index) => (
                    <tr
                      key={`${lead.sessionId}-${lead.createdAt}`}
                      className="border-b border-border last:border-b-0"
                    >
                      <td
                        className={cn(
                          tdClassName,
                          "text-muted-foreground tabular-nums"
                        )}
                      >
                        {index + 1}
                      </td>
                      <td className={cn(tdClassName, "whitespace-nowrap")}>
                        {formatWhen(lead.createdAt)}
                      </td>
                      <td className={cn(tdClassName, "whitespace-nowrap")}>
                        {cellValue(lead.zip)}
                      </td>
                      <td className={cn(tdClassName, "max-w-[14rem]")}>
                        <span className="break-all">
                          {cellValue(lead.email)}
                        </span>
                      </td>
                      <td className={cn(tdClassName, "whitespace-nowrap")}>
                        {cellValue(lead.utmSource)}
                      </td>
                      <td className={cn(tdClassName, "whitespace-nowrap")}>
                        {cellValue(lead.utmId)}
                      </td>
                      <td className={tdClassName}>
                        <span
                          className={cn(
                            "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                            lead.formSubmitted
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-neutral-100 text-neutral-600"
                          )}
                        >
                          {lead.formSubmitted ? "Yes" : "No"}
                        </span>
                      </td>
                      {fieldKeys.map((key) => (
                        <td
                          key={key}
                          className={cn(
                            tdClassName,
                            isAddressFieldKey(key)
                              ? "max-w-[18rem] min-w-[12rem] break-words whitespace-normal"
                              : "max-w-[14rem] whitespace-nowrap"
                          )}
                        >
                          {cellValue(lead.fields[key])}
                        </td>
                      ))}
                      <td
                        className={cn(
                          tdClassName,
                          "font-mono text-xs text-muted-foreground"
                        )}
                      >
                        {lead.sessionId.slice(0, 8)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {dashboardData.hasMore ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-lg border-neutral-200 bg-white shadow-xs"
          disabled={loadingMore}
          onClick={() => void fetchPage(dashboardData.leads.length, true)}
        >
          {loadingMore ? "Loading..." : "Show 15 more"}
        </Button>
      ) : null}
    </div>
  )
}
