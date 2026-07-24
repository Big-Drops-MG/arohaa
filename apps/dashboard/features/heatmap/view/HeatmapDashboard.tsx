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
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import {
  overviewSelectContentClassName,
  overviewSelectItemClassName,
  overviewSelectTriggerClassName,
} from "@/features/overview/view/overview-select-styles"
import { getHeatmapEmptyDashboardData } from "@/features/heatmap/controller/heatmap-empty-data"
import {
  HEATMAP_DEFAULT_OPACITY,
  HEATMAP_DEVICES,
  HEATMAP_MODES,
  parseHeatmapDevice,
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

function normalizeDevice(device: HeatmapDevice): HeatmapDevice {
  return device === "all" ? "desktop" : parseHeatmapDevice(device)
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
  const [device, setDevice] = useState<HeatmapDevice>(
    normalizeDevice(initialData.device)
  )
  const [isLoading, setIsLoading] = useState(false)

  const fetchHeatmap = useCallback(
    async (
      rangeId: OverviewDateRangeId,
      next: {
        mode: HeatmapMode
        device: HeatmapDevice
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

    const initialDevice = normalizeDevice(initialData.device)
    const canUseInitial =
      shouldUseInitialTabData(
        dateRangeId,
        initialData.defaultDateRangeId,
        undefined,
        customRange
      ) &&
      mode === initialData.mode &&
      device === initialDevice

    if (canUseInitial) {
      setDashboardData(initialData)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    void fetchHeatmap(dateRangeId, { mode, device }, controller.signal)
    return () => controller.abort()
  }, [
    isActive,
    customRange,
    dateRangeId,
    device,
    fetchHeatmap,
    initialData,
    mode,
  ])

  const hasData =
    dashboardData.totalEvents > 0 ||
    dashboardData.cells.length > 0 ||
    dashboardData.points.length > 0 ||
    dashboardData.scrollBuckets.length > 0

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
                Heat is tied to page position, so lower sections light up after
                document-relative events are collected.
              </li>
              <li>
                Older viewport-only events stay near the top of the preview.
              </li>
            </ul>
          </div>
        }
      />

      <div
        className={cn(
          "relative",
          isLoading && "pointer-events-none opacity-60"
        )}
        aria-busy={isLoading}
      >
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

      <div className="flex justify-center px-1">
        <div className="flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-neutral-200/90 bg-white px-2.5 py-1.5 shadow-md shadow-neutral-950/5 sm:gap-2.5 sm:px-3">
          <Select
            value={mode}
            onValueChange={(value) => setMode(value as HeatmapMode)}
          >
            <SelectTrigger
              size="sm"
              aria-label="Heatmap mode"
              className={cn(
                overviewSelectTriggerClassName,
                "h-8 min-w-[6.5rem] rounded-full border-neutral-200/80 bg-neutral-50 px-2.5 text-xs shadow-none"
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              align="center"
              className={overviewSelectContentClassName}
            >
              {HEATMAP_MODES.map((option) => (
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

          <div className="h-4 w-px bg-neutral-200" aria-hidden />

          <Select
            value={device === "all" ? "desktop" : device}
            onValueChange={(value) => setDevice(parseHeatmapDevice(value))}
          >
            <SelectTrigger
              size="sm"
              aria-label="Heatmap device"
              className={cn(
                overviewSelectTriggerClassName,
                "h-8 min-w-[7rem] rounded-full border-neutral-200/80 bg-neutral-50 px-2.5 text-xs shadow-none"
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              align="center"
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

          <div className="h-4 w-px bg-neutral-200" aria-hidden />

          <div
            className="flex items-center gap-2 pr-1"
            title="Heat intensity legend"
          >
            <div className="flex flex-col gap-0.5">
              <div
                className="h-1.5 w-24 rounded-full sm:w-28"
                style={{
                  background:
                    "linear-gradient(to right, #3b82f6, #22d3ee, #facc15, #ef4444)",
                }}
              />
              <div className="flex justify-between text-[9px] text-neutral-400">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>
          </div>
        </div>
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
