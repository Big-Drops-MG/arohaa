"use client"

import { useCallback, useEffect, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import { getHeatmapEmptyDashboardData } from "@/features/heatmap/controller/heatmap-empty-data"
import {
  HEATMAP_DEVICES,
  HEATMAP_MODES,
  type HeatmapDashboardData,
  type HeatmapDevice,
  type HeatmapMode,
} from "@/features/heatmap/model/heatmap"
import { HeatmapCanvas } from "@/features/heatmap/view/HeatmapCanvas"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import {
  buildAnalyticsApiPath,
  shouldUseInitialTabData,
} from "@/lib/dashboard/analytics-query"

type HeatmapDashboardProps = {
  data: HeatmapDashboardData
  projectId: string
  isActive?: boolean
}

function shortUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.host}${parsed.pathname}`.replace(/\/$/, "") || url
  } catch {
    return url.length > 64 ? `${url.slice(0, 61)}…` : url
  }
}

export function HeatmapDashboard({
  data: initialData,
  projectId,
  isActive = true,
}: HeatmapDashboardProps) {
  const { dateRangeId, customRange, setDateRangeId, setCustomRange } =
    useDashboardDateRange()
  const [dashboardData, setDashboardData] = useState(initialData)
  const [mode, setMode] = useState<HeatmapMode>(initialData.mode)
  const [device, setDevice] = useState<HeatmapDevice>(initialData.device)
  const [pageUrl, setPageUrl] = useState<string | null>(initialData.pageUrl)
  const [opacity, setOpacity] = useState(initialData.opacity)
  const [isLoading, setIsLoading] = useState(false)

  const fetchHeatmap = useCallback(
    async (
      rangeId: OverviewDateRangeId,
      next: {
        mode: HeatmapMode
        device: HeatmapDevice
        pageUrl: string | null
      },
      signal?: AbortSignal
    ) => {
      setIsLoading(true)
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
          setDashboardData(
            getHeatmapEmptyDashboardData(
              projectId,
              rangeId,
              next.mode,
              next.device
            )
          )
          return
        }
        const payload = (await res.json()) as HeatmapDashboardData
        setDashboardData(payload)
        if (!next.pageUrl && payload.pageUrl) {
          setPageUrl(payload.pageUrl)
        }
      } catch (err) {
        if (signal?.aborted) return
        if (process.env.NODE_ENV === "development") {
          console.error("[heatmap] client fetch failed", err)
        }
        setDashboardData(
          getHeatmapEmptyDashboardData(
            projectId,
            rangeId,
            next.mode,
            next.device
          )
        )
      } finally {
        if (!signal?.aborted) setIsLoading(false)
      }
    },
    [projectId, customRange]
  )

  useEffect(() => {
    if (!isActive) return

    const canUseInitial =
      shouldUseInitialTabData(
        dateRangeId,
        initialData.defaultDateRangeId,
        undefined,
        customRange
      ) &&
      mode === initialData.mode &&
      device === initialData.device &&
      (pageUrl === initialData.pageUrl ||
        (pageUrl == null && initialData.pageUrl == null))

    if (canUseInitial) {
      setDashboardData(initialData)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    void fetchHeatmap(dateRangeId, { mode, device, pageUrl }, controller.signal)
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

  const hasData =
    dashboardData.totalEvents > 0 ||
    dashboardData.cells.length > 0 ||
    dashboardData.scrollBuckets.length > 0

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 sm:px-6">
      <OverviewHeader
        title="Heatmap"
        projectId={projectId}
        dateRangeOptions={dashboardData.dateRangeOptions}
        dateRangeId={dateRangeId}
        onDateRangeChange={setDateRangeId}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
      />

      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Scroll inside the preview to move down the page. The heatmap stays
        locked to the page content (it will not float over lower sections).
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[140px] flex-col gap-1 text-xs font-medium text-neutral-600">
          Mode
          <select
            className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm text-neutral-900"
            value={mode}
            onChange={(e) => setMode(e.target.value as HeatmapMode)}
          >
            {HEATMAP_MODES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[160px] flex-col gap-1 text-xs font-medium text-neutral-600">
          Device
          <select
            className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm text-neutral-900"
            value={device}
            onChange={(e) => setDevice(e.target.value as HeatmapDevice)}
          >
            {HEATMAP_DEVICES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-neutral-600">
          Page URL
          <select
            className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm text-neutral-900"
            value={pageUrl ?? ""}
            onChange={(e) => setPageUrl(e.target.value || null)}
            disabled={dashboardData.pageUrls.length === 0}
          >
            {dashboardData.pageUrls.length === 0 ? (
              <option value="">No heatmap pages yet</option>
            ) : (
              dashboardData.pageUrls.map((url) => (
                <option key={url} value={url}>
                  {shortUrl(url)}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="flex min-w-[160px] flex-col gap-1 text-xs font-medium text-neutral-600">
          Opacity {Math.round(opacity * 100)}%
          <input
            type="range"
            min={0.15}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="h-9"
          />
        </label>

        <div className="flex flex-col gap-1 text-xs text-neutral-500">
          <span className="font-medium text-neutral-600">Legend</span>
          <div className="flex h-3 w-40 overflow-hidden rounded-sm">
            <div className="flex-1 bg-blue-500" />
            <div className="flex-1 bg-cyan-400" />
            <div className="flex-1 bg-yellow-400" />
            <div className="flex-1 bg-red-500" />
          </div>
          <div className="flex justify-between text-[10px]">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "relative",
          isLoading && "pointer-events-none opacity-60"
        )}
        aria-busy={isLoading}
      >
        {!hasData ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-6 text-center text-sm text-neutral-500">
            No heatmap data for this range yet. Clicks, scroll depth, and
            attention will appear here after the SDK starts collecting.
          </div>
        ) : (
          <HeatmapCanvas
            mode={dashboardData.mode}
            device={device}
            cells={dashboardData.cells}
            scrollBuckets={dashboardData.scrollBuckets}
            maxValue={dashboardData.maxValue}
            opacity={opacity}
            backgroundUrl={dashboardData.pageUrl}
          />
        )}
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
                  {Math.round(section.dwellMs / 1000)}s · {section.views} views
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasData ? (
        <p className="text-xs text-neutral-500">
          {dashboardData.totalEvents.toLocaleString()} events in selected range
          {dashboardData.pageUrl ? ` · ${shortUrl(dashboardData.pageUrl)}` : ""}
        </p>
      ) : null}
    </div>
  )
}
