"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
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
import { discoverVisibleLeadFieldKeys } from "@/features/data-export/model/lead-field-columns"
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
  getDashboardZonedParts,
} from "@/lib/datetime"

type DataExportDashboardProps = {
  data: DataExportDashboardData
  projectId: string
  isActive?: boolean
  isLoading?: boolean
  /** When true, omit the page header (used inside Data Lab). */
  embedded?: boolean
  onDataChange?: (data: DataExportDashboardData) => void
}

const thClassName =
  "px-4 py-2.5 text-left text-xs font-semibold whitespace-nowrap text-muted-foreground"

const tdClassName =
  "px-4 py-2.5 align-middle text-sm whitespace-nowrap text-foreground"

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

function isAddressFieldKey(key: string): boolean {
  return /^address(_line_?[12])?$/i.test(key.trim())
}

function cellValue(value: string | undefined): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : "—"
}

function pad2(value: string): string {
  return value.replace(/\D/g, "").padStart(2, "0").slice(-2)
}

function parseDobParts(
  raw: string
): { month: number; day: number; year: number } | null {
  const trimmed = raw.trim()
  const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (!match) return null

  const month = Number(match[1])
  const day = Number(match[2])
  const year = Number(match[3])
  if (
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    year < 1900
  ) {
    return null
  }

  return { month, day, year }
}

function formatDob(raw: string): string {
  const parts = parseDobParts(raw)
  if (!parts) return cellValue(raw)
  return `${pad2(String(parts.month))}/${pad2(String(parts.day))}/${parts.year}`
}

function ageFromDob(raw: string | undefined): string {
  if (!raw?.trim()) return "—"
  const parts = parseDobParts(raw)
  if (!parts) return "—"

  const now = getDashboardZonedParts(new Date())
  let age = now.year - parts.year
  if (
    now.month < parts.month ||
    (now.month === parts.month && now.day < parts.day)
  ) {
    age -= 1
  }
  if (age < 0 || age > 120) return "—"
  return String(age)
}

function formatFieldCell(key: string, value: string | undefined): string {
  if (/^dob$/i.test(key.trim()) && value?.trim()) {
    return formatDob(value)
  }
  return cellValue(value)
}

function isDobFieldKey(key: string): boolean {
  return /^dob$/i.test(key.trim())
}

type DataExportFieldColumn =
  | { kind: "field"; key: string }
  | { kind: "age"; dobKey: string }

function buildFieldColumns(fieldKeys: string[]): DataExportFieldColumn[] {
  const columns: DataExportFieldColumn[] = []
  for (const key of fieldKeys) {
    columns.push({ kind: "field", key })
    if (isDobFieldKey(key)) columns.push({ kind: "age", dobKey: key })
  }
  return columns
}

function formatEntryCount(total: number): string {
  return `${total.toLocaleString()} ${total === 1 ? "entry" : "entries"}`
}

export function DataExportDashboard({
  data: initialData,
  projectId,
  isActive = true,
  isLoading: isTabLoading = false,
  embedded = false,
  onDataChange,
}: DataExportDashboardProps) {
  const { dateRangeId, customRange, setDateRangeId, setCustomRange } =
    useDashboardDateRange()
  const [dashboardData, setDashboardData] = useState(initialData)
  const [pageOffset, setPageOffset] = useState(initialData.offset)
  const [isBlockingLoad, setIsBlockingLoad] = useState(false)
  const [isPageLoading, setIsPageLoading] = useState(false)

  const pageSize = dashboardData.limit || DATA_EXPORT_PAGE_SIZE
  const total = dashboardData.total
  const currentPage = total === 0 ? 1 : Math.floor(pageOffset / pageSize) + 1
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1)
  const rangeStart = total === 0 ? 0 : pageOffset + 1
  const rangeEnd = Math.min(pageOffset + dashboardData.leads.length, total)
  const canGoPrev = pageOffset > 0 && total > 0
  const canGoNext = pageOffset + pageSize < total

  const fieldKeys = useMemo(
    () =>
      dashboardData.visibleLeadFieldKeys.length > 0
        ? dashboardData.visibleLeadFieldKeys
        : discoverVisibleLeadFieldKeys(dashboardData.leads),
    [dashboardData.leads, dashboardData.visibleLeadFieldKeys]
  )

  const fieldColumns = useMemo(() => buildFieldColumns(fieldKeys), [fieldKeys])

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
        { rangeId: dateRangeId, customRange }
      )
      const withPaging = new URL(url, window.location.origin)
      withPaging.searchParams.set("limit", String(DATA_EXPORT_PAGE_SIZE))
      withPaging.searchParams.set("offset", String(offset))
      try {
        const res = await fetch(withPaging.pathname + withPaging.search, {
          cache: "no-store",
          signal,
        })
        if (!res.ok) {
          if (!quiet) {
            setDashboardData(
              getDataExportEmptyDashboardData(
                dateRangeId,
                dashboardData.hasRedirect,
                dashboardData.brandName
              )
            )
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
          setDashboardData(
            getDataExportEmptyDashboardData(
              dateRangeId,
              dashboardData.hasRedirect,
              dashboardData.brandName
            )
          )
          setPageOffset(0)
        }
      } finally {
        if (!signal?.aborted) {
          setIsBlockingLoad(false)
          setIsPageLoading(false)
        }
      }
    },
    [
      customRange,
      dashboardData.brandName,
      dashboardData.hasRedirect,
      dateRangeId,
      onDataChange,
      projectId,
    ]
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
      setPageOffset(initialData.offset)
      onDataChange?.(initialData)
      return
    }
    const controller = new AbortController()
    void fetchPage(0, controller.signal)
    return () => controller.abort()
  }, [customRange, dateRangeId, fetchPage, initialData, isActive, onDataChange])

  useEffect(() => {
    if (!isActive || !dashboardData.hasRedirect) return
    const controller = new AbortController()
    const id = setInterval(() => {
      void fetchPage(pageOffset, controller.signal, { quiet: true })
    }, 15_000)
    return () => {
      clearInterval(id)
      controller.abort()
    }
  }, [dashboardData.hasRedirect, fetchPage, isActive, pageOffset])

  function goToPage(nextOffset: number) {
    if (isPageLoading || isBlockingLoad) return
    const lastPageOffset =
      total === 0 ? 0 : Math.floor((total - 1) / pageSize) * pageSize
    const clamped = Math.min(Math.max(0, nextOffset), lastPageOffset)
    if (clamped === pageOffset) return
    void fetchPage(clamped, undefined, { pageOnly: true })
  }

  const header = embedded ? null : (
    <OverviewHeader
      title="Data Export"
      helpContent="Captured offer-form details for this landing page."
      dateRangeId={dateRangeId}
      onDateRangeChange={setDateRangeId}
      customRange={customRange}
      onCustomRangeChange={setCustomRange}
      dateRangeOptions={dashboardData.dateRangeOptions}
    />
  )

  if (isTabLoading || isBlockingLoad) {
    return (
      <div className="space-y-4">
        {header}
        <div className="h-40 animate-pulse rounded-xl border border-border bg-muted/40" />
      </div>
    )
  }

  if (!dashboardData.hasRedirect) {
    return (
      <div className="space-y-4">
        {header}
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

  const colCount = 10 + fieldColumns.length
  const projectLabel = dashboardData.brandName.trim() || "Project"

  return (
    <div className="space-y-4">
      {header}

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
          <div className="min-w-0">
            <CardTitle className={overviewSectionHeadingClassName}>
              Captured leads
            </CardTitle>
            <p className="mt-0.5 truncate text-sm font-medium text-foreground">
              {projectLabel}
            </p>
          </div>
          <p className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {formatEntryCount(total)}
          </p>
        </CardHeader>
        <CardContent className="overflow-hidden p-0">
          <div
            className={cn(
              "overflow-x-auto",
              isPageLoading && "pointer-events-none opacity-60"
            )}
          >
            <table className="w-max min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className={thClassName}>#</th>
                  <th className={thClassName}>When</th>
                  <th className={thClassName}>Zip</th>
                  <th className={thClassName}>Email</th>
                  <th className={thClassName}>utm_source</th>
                  <th className={thClassName}>utm_id</th>
                  <th className={thClassName}>TrustedForm</th>
                  <th className={thClassName}>Form Submitted</th>
                  {fieldColumns.map((column) =>
                    column.kind === "age" ? (
                      <th key={`age-${column.dobKey}`} className={thClassName}>
                        Age
                      </th>
                    ) : (
                      <th key={column.key} className={thClassName}>
                        {column.key}
                      </th>
                    )
                  )}
                  <th className={thClassName}>MAC id</th>
                  <th className={thClassName}>Session</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.leads.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
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
                        {pageOffset + index + 1}
                      </td>
                      <td className={tdClassName}>
                        {formatWhen(lead.createdAt)}
                      </td>
                      <td className={tdClassName}>{cellValue(lead.zip)}</td>
                      <td className={tdClassName}>{cellValue(lead.email)}</td>
                      <td className={tdClassName}>
                        {cellValue(lead.utmSource)}
                      </td>
                      <td className={tdClassName}>{cellValue(lead.utmId)}</td>
                      <td
                        className={cn(
                          tdClassName,
                          "max-w-[14rem] min-w-[10rem] whitespace-normal"
                        )}
                      >
                        {lead.trustedFormUrl ? (
                          <a
                            href={lead.trustedFormUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium break-all text-sky-700 underline-offset-2 hover:underline"
                          >
                            View certificate
                          </a>
                        ) : (
                          "—"
                        )}
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
                      {fieldColumns.map((column) =>
                        column.kind === "age" ? (
                          <td
                            key={`age-${column.dobKey}`}
                            className={cn(
                              tdClassName,
                              "text-muted-foreground tabular-nums"
                            )}
                          >
                            {ageFromDob(lead.fields[column.dobKey])}
                          </td>
                        ) : (
                          <td
                            key={column.key}
                            className={cn(
                              tdClassName,
                              isAddressFieldKey(column.key) &&
                                "max-w-[16rem] min-w-[12rem] whitespace-normal"
                            )}
                          >
                            {formatFieldCell(
                              column.key,
                              lead.fields[column.key]
                            )}
                          </td>
                        )
                      )}
                      <td
                        className={cn(
                          tdClassName,
                          "font-mono text-xs text-muted-foreground"
                        )}
                      >
                        {cellValue(lead.macId)}
                      </td>
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
                disabled={!canGoPrev || isPageLoading}
                onClick={() => goToPage(pageOffset - pageSize)}
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
                disabled={!canGoNext || isPageLoading}
                onClick={() => goToPage(pageOffset + pageSize)}
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
