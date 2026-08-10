"use client"

import { useCallback, useEffect, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import { HeatmapDashboardSkeleton } from "@/features/dashboard/view/dashboard-skeletons"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import {
  overviewSelectContentClassName,
  overviewSelectItemClassName,
  overviewSelectTriggerClassName,
} from "@/features/overview/view/overview-select-styles"
import {
  HEATMAP_DEFAULT_OPACITY,
  HEATMAP_DEVICES,
  HEATMAP_MODES,
  parseHeatmapDevice,
  parseHeatmapMode,
  type HeatmapDashboardData,
  type HeatmapDevice,
  type HeatmapMode,
} from "@/features/heatmap/model/heatmap"
import { HeatmapCanvas } from "@/features/heatmap/view/HeatmapCanvas"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import { useDashboardQueryParam } from "@/hooks/use-dashboard-query-param"
import type { AnalyticsFetchMode } from "@/lib/dashboard/analytics-fetch-mode"
import {
  buildAnalyticsApiPath,
  shouldUseInitialTabData,
} from "@/lib/dashboard/analytics-query"

type HeatmapDashboardProps = {
  data: HeatmapDashboardData
  projectId: string
  isActive?: boolean
  isLoading?: boolean
  allowedModes?: string[] | null
}

function shortUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const path = `${parsed.host}${parsed.pathname}`.replace(/\/$/, "") || url
    const hash = parsed.hash ? parsed.hash.slice(0, 24) : ""
    return hash ? `${path}${hash}` : path
  } catch {
    return url.length > 64 ? `${url.slice(0, 61)}…` : url
  }
}

function normalizeDevice(device: HeatmapDevice): HeatmapDevice {
  return device === "all" ? "desktop" : parseHeatmapDevice(device)
}

export function HeatmapDashboard({
  data: initialData,
  projectId,
  isActive = true,
  isLoading: isTabLoading = false,
  allowedModes = null,
}: HeatmapDashboardProps) {
  const visibleModes = allowedModes
    ? HEATMAP_MODES.filter((mode) => allowedModes.includes(mode.value))
    : HEATMAP_MODES
  const defaultMode = visibleModes[0]?.value ?? "click"
  const { dateRangeId, customRange, setDateRangeId, setCustomRange } =
    useDashboardDateRange()
  const [dashboardData, setDashboardData] = useState(initialData)
  const [mode, setMode] = useDashboardQueryParam("mode", {
    parse: (raw) => {
      const parsed = parseHeatmapMode(raw)
      if (allowedModes && !allowedModes.includes(parsed)) {
        return defaultMode as HeatmapMode
      }
      return parsed
    },
    projectId,
    omitDefault: true,
  })
  const [device, setDevice] = useDashboardQueryParam("device", {
    parse: (raw) => normalizeDevice(parseHeatmapDevice(raw)),
    projectId,
    omitDefault: true,
  })
  const [pageUrl, setPageUrl] = useDashboardQueryParam("page_url", {
    parse: (raw) => (raw?.trim() ? raw.trim() : ""),
    projectId,
    omitDefault: true,
  })
  const [isBlockingLoad, setIsBlockingLoad] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchHeatmap = useCallback(
    async (
      rangeId: OverviewDateRangeId,
      next: {
        mode: HeatmapMode
        device: HeatmapDevice
        pageUrl?: string
      },
      signal?: AbortSignal,
      fetchMode: AnalyticsFetchMode = "blocking"
    ) => {
      if (fetchMode === "blocking") setIsBlockingLoad(true)
      else setIsRefreshing(true)
      const url = buildAnalyticsApiPath(
        `/api/landing-pages/${encodeURIComponent(projectId)}/heatmap`,
        {
          rangeId,
          customRange,
          extra: {
            mode: next.mode,
            device: next.device,
            ...(next.pageUrl ? { page_url: next.pageUrl } : {}),
          },
        }
      )
      try {
        const res = await fetch(url, { cache: "no-store", signal })
        if (!res.ok) {
          if (process.env.NODE_ENV === "development") {
            console.error(`[heatmap] client fetch ${res.status}`, url)
          }
          return
        }
        const payload = (await res.json()) as HeatmapDashboardData
        setDashboardData(payload)
      } catch (err) {
        if (signal?.aborted) return
        if (process.env.NODE_ENV === "development") {
          console.error("[heatmap] client fetch failed", err)
        }
      } finally {
        if (!signal?.aborted) {
          if (fetchMode === "blocking") setIsBlockingLoad(false)
          else setIsRefreshing(false)
        }
      }
    },
    [projectId, customRange]
  )

  useEffect(() => {
    if (!isActive) return

    const initialDevice = normalizeDevice(initialData.device)
    const initialPage = initialData.pageUrl ?? ""
    const canUseInitial =
      shouldUseInitialTabData(
        dateRangeId,
        initialData.defaultDateRangeId,
        undefined,
        customRange
      ) &&
      mode === initialData.mode &&
      device === initialDevice &&
      (!pageUrl || pageUrl === initialPage)

    if (canUseInitial) {
      setDashboardData(initialData)
      setIsBlockingLoad(false)
      return
    }

    const controller = new AbortController()
    void fetchHeatmap(
      dateRangeId,
      { mode, device, pageUrl: pageUrl || undefined },
      controller.signal,
      "background"
    )
    return () => controller.abort()
  }, [
    isActive,
    customRange,
    dateRangeId,
    device,
    fetchHeatmap,
    initialData,
    mode,
    pageUrl,
  ])

  const pageOptions =
    dashboardData.pageUrls.length > 0
      ? dashboardData.pageUrls
      : dashboardData.pageUrl
        ? [dashboardData.pageUrl]
        : []
  const selectedPageUrl =
    pageUrl || dashboardData.pageUrl || pageOptions[0] || ""

  const hasData =
    dashboardData.totalEvents > 0 ||
    dashboardData.cells.length > 0 ||
    dashboardData.points.length > 0 ||
    dashboardData.scrollBuckets.length > 0 ||
    dashboardData.fields.length > 0

  const emptyMessage =
    mode === "form"
      ? "No form field heat for this range yet. Focus and clicks on form fields appear after the SDK update collects traffic on the redirect page."
      : "No heatmap data for this range yet. Clicks, scroll depth, and attention will appear here after the SDK starts collecting."

  return (
    <div className="flex flex-col gap-4 px-6 pb-6 lg:px-8">
      <OverviewHeader
        title="Heatmap"
        projectId={projectId}
        dateRangeOptions={dashboardData.dateRangeOptions}
        dateRangeId={dateRangeId}
        onDateRangeChange={setDateRangeId}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
        helpContent={
          <div className="space-y-2">
            <p className="font-semibold text-white">How to read this heatmap</p>
            <ul className="list-disc space-y-1.5 pl-4 text-neutral-200">
              <li>Scroll the preview to move down the landing page.</li>
              <li>
                Heat is mapped with page-relative coordinates onto the same
                device-width layout visitors used, so clicks sit on the real
                controls.
              </li>
              <li>
                Desktop / Tablet / Mobile each show every click, scroll, and
                attention event captured on that device type — independent of
                the screen you are viewing the dashboard on.
              </li>
              <li>
                Form mode shows field focus and clicks on the redirect offer
                form. Pick the redirect page URL when it differs from the zip
                landing.
              </li>
            </ul>
          </div>
        }
        actions={
          <>
            <Select
              value={mode}
              onValueChange={(value) => setMode(value as HeatmapMode)}
            >
              <SelectTrigger
                aria-label="Heatmap mode"
                className={cn(
                  overviewSelectTriggerClassName,
                  "w-full sm:w-auto sm:min-w-32"
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                align="end"
                className={overviewSelectContentClassName}
              >
                {visibleModes.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className={overviewSelectItemClassName}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={device === "all" ? "desktop" : device}
              onValueChange={(value) => setDevice(parseHeatmapDevice(value))}
            >
              <SelectTrigger
                aria-label="Heatmap device"
                className={cn(
                  overviewSelectTriggerClassName,
                  "w-full sm:w-auto sm:min-w-32"
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                align="end"
                className={overviewSelectContentClassName}
              >
                {HEATMAP_DEVICES.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className={overviewSelectItemClassName}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {pageOptions.length > 0 ? (
              <Select
                value={selectedPageUrl}
                onValueChange={(value) => setPageUrl(value)}
              >
                <SelectTrigger
                  aria-label="Heatmap page"
                  className={cn(
                    overviewSelectTriggerClassName,
                    "w-full sm:w-auto sm:max-w-72 sm:min-w-44"
                  )}
                >
                  <SelectValue placeholder="Page" />
                </SelectTrigger>
                <SelectContent
                  align="end"
                  className={overviewSelectContentClassName}
                >
                  {pageOptions.map((url) => (
                    <SelectItem
                      key={url}
                      value={url}
                      className={overviewSelectItemClassName}
                    >
                      {shortUrl(url)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            <div
              className="flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 shadow-xs"
              title="Heat intensity legend"
            >
              <div className="flex min-w-24 flex-col gap-0.5 sm:min-w-28">
                <div
                  className="h-1.5 w-full rounded-full"
                  style={{
                    background:
                      "linear-gradient(to right, #3b82f6, #22d3ee, #facc15, #ef4444)",
                  }}
                />
                <div className="flex justify-between text-[9px] leading-none text-neutral-400">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
            </div>
          </>
        }
      />

      {isTabLoading || isBlockingLoad ? (
        <HeatmapDashboardSkeleton />
      ) : (
        <div
          className={cn(
            "flex flex-col gap-4 transition-opacity",
            isRefreshing && "opacity-80"
          )}
          aria-busy={isRefreshing}
        >
          <div className="relative">
            <HeatmapCanvas
              mode={dashboardData.mode}
              device={device}
              cells={dashboardData.cells}
              points={dashboardData.points}
              scrollBuckets={dashboardData.scrollBuckets}
              maxValue={dashboardData.maxValue}
              opacity={HEATMAP_DEFAULT_OPACITY}
              backgroundUrl={dashboardData.pageUrl}
              emptyState={!hasData}
              emptyMessage="No heatmap data for this range yet. Clicks, scroll depth, and attention will appear here after the SDK starts collecting."
            />
          </div>

          {mode === "attention" && dashboardData.sections.length > 0 ? (
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold text-neutral-900">
                Section dwell
              </h3>
              <ul className="divide-y divide-neutral-100 text-sm">
                {dashboardData.sections.slice(0, 12).map((section) => (
                  <li
                    key={section.selector}
                    className="flex items-center justify-between gap-4 py-2"
                  >
                    <code className="truncate text-xs text-neutral-700">
                      {section.selector}
                    </code>
                    <span className="shrink-0 text-neutral-500">
                      {Math.round(section.dwellMs / 1000)}s · {section.views}{" "}
                      views
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {mode === "form" && dashboardData.fields.length > 0 ? (
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold text-neutral-900">
                Field focus
              </h3>
              <ul className="divide-y divide-neutral-100 text-sm">
                {dashboardData.fields.slice(0, 12).map((field) => (
                  <li
                    key={field.fieldName}
                    className="flex items-center justify-between gap-4 py-2"
                  >
                    <code className="truncate text-xs text-neutral-700">
                      {field.fieldName}
                    </code>
                    <span className="shrink-0 text-neutral-500">
                      {field.count.toLocaleString()} events
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {hasData ? (
            <p className="text-xs text-neutral-500">
              {dashboardData.totalEvents.toLocaleString()} events in selected
              range
              {dashboardData.pageUrl
                ? ` · ${shortUrl(dashboardData.pageUrl)}`
                : ""}
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
