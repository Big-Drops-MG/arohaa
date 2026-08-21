"use client"

import { useCallback, useEffect, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { WebVitalDashboardSkeleton } from "@/features/dashboard/view/dashboard-skeletons"
import { getWebVitalEmptyDashboardData } from "@/features/web-vital/controller/web-vital-empty-data"
import {
  WEB_VITAL_EMPTY_DEVICES,
  type WebVitalDashboardData,
} from "@/features/web-vital/model/web-vital"
import {
  formatWebVitalRating,
  formatWebVitalValue,
  metricDescription,
  metricLabel,
  webVitalRatingClassName,
} from "@/features/web-vital/utils/web-vital-format"
import { LighthouseScoreGauge } from "@/features/web-vital/view/LighthouseScoreGauge"
import { WebVitalsUsaMap } from "@/features/web-vital/view/WebVitalsUsaMap"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import type { AnalyticsFetchMode } from "@/lib/dashboard/analytics-fetch-mode"
import {
  buildAnalyticsApiPath,
  shouldUseInitialTabData,
} from "@/lib/dashboard/analytics-query"

type WebVitalDashboardProps = {
  data: WebVitalDashboardData
  projectId: string
  isActive?: boolean
  isLoading?: boolean
}

function formatDeviceLabel(device: string): string {
  if (!device) return "Unknown"
  return device.charAt(0).toUpperCase() + device.slice(1)
}

export function WebVitalDashboard({
  data: initialData,
  projectId,
  isActive = true,
  isLoading: isTabLoading = false,
}: WebVitalDashboardProps) {
  const { dateRangeId, customRange, setDateRangeId, setCustomRange } =
    useDashboardDateRange()
  const [dashboardData, setDashboardData] = useState(initialData)
  const [isBlockingLoad, setIsBlockingLoad] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchWebVital = useCallback(
    async (
      rangeId: typeof dateRangeId,
      signal?: AbortSignal,
      mode: AnalyticsFetchMode = "blocking"
    ) => {
      if (mode === "blocking") setIsBlockingLoad(true)
      else setIsRefreshing(true)
      const url = buildAnalyticsApiPath(
        `/api/landing-pages/${encodeURIComponent(projectId)}/web-vital`,
        { rangeId, customRange }
      )
      try {
        const res = await fetch(url, { cache: "no-store", signal })
        if (!res.ok) {
          if (mode === "blocking") {
            setDashboardData(getWebVitalEmptyDashboardData(projectId, rangeId))
          }
          return
        }
        const next = (await res.json()) as WebVitalDashboardData
        setDashboardData(next)
      } catch {
        if (signal?.aborted) return
        if (mode === "blocking") {
          setDashboardData(getWebVitalEmptyDashboardData(projectId, rangeId))
        }
      } finally {
        if (!signal?.aborted) {
          if (mode === "blocking") setIsBlockingLoad(false)
          else setIsRefreshing(false)
        }
      }
    },
    [projectId, customRange]
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
      setIsBlockingLoad(false)
      return
    }

    const controller = new AbortController()
    void fetchWebVital(dateRangeId, controller.signal, "background")
    return () => controller.abort()
  }, [isActive, customRange, dateRangeId, fetchWebVital, initialData])

  const deviceRows =
    dashboardData.devices.length > 0
      ? dashboardData.devices
      : WEB_VITAL_EMPTY_DEVICES

  return (
    <div className="flex flex-col gap-4 pb-6">
      <OverviewHeader
        title="Web Vitals"
        projectId={projectId}
        dateRangeOptions={dashboardData.dateRangeOptions}
        dateRangeId={dateRangeId}
        customRange={customRange}
        onDateRangeChange={setDateRangeId}
        onCustomRangeChange={setCustomRange}
        helpContent={
          <div className="space-y-2">
            <p className="font-semibold text-white">How to read Web Vitals</p>
            <ul className="list-disc space-y-1.5 pl-4 text-neutral-200">
              <li>
                <span className="font-medium text-white">p75</span> is the 75th
                percentile: 75% of visits were at this value or better (lower
                for timing metrics; lower CLS is better).
              </li>
              <li>
                Values come from real field visits (LCP, FCP, CLS, INP via the
                SDK).
              </li>
              <li>
                Lighthouse score is a weighted composite of FCP, LCP, INP, and
                CLS.
              </li>
              <li>
                The map shows performance score by US state where samples are
                available.
              </li>
            </ul>
          </div>
        }
      />

      {isTabLoading || isBlockingLoad ? (
        <WebVitalDashboardSkeleton />
      ) : (
        <div
          className={cn(
            "grid gap-4 transition-opacity lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-stretch",
            isRefreshing && "opacity-80"
          )}
          aria-busy={isRefreshing}
        >
          <div className="flex flex-col gap-3">
            <LighthouseScoreGauge score={dashboardData.lighthouseScore ?? 0} />

            {dashboardData.metrics.map((metric) => (
              <div
                key={metric.name}
                className="rounded-xl border border-border bg-white px-4 py-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900">
                      {metric.name}
                    </p>
                    <p className="truncate text-[11px] text-neutral-500">
                      {metricLabel(metric.name)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                      webVitalRatingClassName(metric.rating)
                    )}
                  >
                    {formatWebVitalRating(metric.rating)}
                  </span>
                </div>

                <p className="mt-2.5 text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums">
                  {formatWebVitalValue(metric.p75, metric.unit)}
                </p>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-neutral-500">
                  <span>
                    p75 · score{" "}
                    <span className="font-medium text-neutral-700 tabular-nums">
                      {metric.score}
                    </span>
                  </span>
                  <span className="text-neutral-300" aria-hidden>
                    ·
                  </span>
                  <span>{metricDescription(metric.name)}</span>
                  <span className="text-neutral-300" aria-hidden>
                    ·
                  </span>
                  <span className="tabular-nums">
                    {metric.samples.toLocaleString()} samples
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex min-h-0 min-w-0 flex-col gap-4">
            <WebVitalsUsaMap
              states={dashboardData.states}
              className="shrink-0"
            />

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-white">
              <div className="shrink-0 border-b border-neutral-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-neutral-900">
                  By device
                </h3>
                <p className="text-xs text-muted-foreground">
                  p75 Core Web Vitals per device class
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-x-auto">
                <table className="h-full w-full min-w-[420px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 text-xs text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Device</th>
                      <th className="px-3 py-2.5 font-medium tabular-nums">
                        Score
                      </th>
                      <th className="px-3 py-2.5 font-medium tabular-nums">
                        LCP
                      </th>
                      <th className="px-3 py-2.5 font-medium tabular-nums">
                        FCP
                      </th>
                      <th className="px-3 py-2.5 font-medium tabular-nums">
                        CLS
                      </th>
                      <th className="px-3 py-2.5 font-medium tabular-nums">
                        INP
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {deviceRows.map((row) => (
                      <tr key={row.device} className="h-[33.333%]">
                        <td className="px-4 py-2.5 align-middle font-medium text-neutral-900">
                          {formatDeviceLabel(row.device)}
                          <span className="mt-0.5 block text-[11px] font-normal text-neutral-400">
                            {row.samples.toLocaleString()} samples
                          </span>
                        </td>
                        <td className="px-3 py-2.5 align-middle text-neutral-700 tabular-nums">
                          {row.performanceScore ?? 0}
                        </td>
                        <td className="px-3 py-2.5 align-middle text-neutral-700 tabular-nums">
                          {formatWebVitalValue(row.lcpP75, "ms")}
                        </td>
                        <td className="px-3 py-2.5 align-middle text-neutral-700 tabular-nums">
                          {formatWebVitalValue(row.fcpP75, "ms")}
                        </td>
                        <td className="px-3 py-2.5 align-middle text-neutral-700 tabular-nums">
                          {formatWebVitalValue(row.clsP75, "unitless")}
                        </td>
                        <td className="px-3 py-2.5 align-middle text-neutral-700 tabular-nums">
                          {formatWebVitalValue(row.inpP75, "ms")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
