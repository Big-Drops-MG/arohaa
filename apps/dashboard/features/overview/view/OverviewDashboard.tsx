"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import type { FunnelDashboardData } from "@/features/funnel/model/funnel"
import {
  overviewKpiLabelsForFormType,
  type OverviewDashboardData,
  type OverviewFunnelStep,
  type OverviewKpiMetricId,
} from "@/features/overview/model/overview"
import { overviewChartPointsForRange } from "@/features/overview/utils/overview-chart-buckets"
import { overviewKpisForDateRange } from "@/features/overview/utils/overview-kpi-row"
import { overviewRechartsPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"
import { OverviewAlertsCard } from "@/features/overview/view/OverviewAlertsCard"
import { OverviewFunnelCard } from "@/features/overview/view/OverviewFunnelCard"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import { OverviewKpiRow } from "@/features/overview/view/OverviewKpiRow"
import { OverviewPerformanceChart } from "@/features/overview/view/OverviewPerformanceChart"
import { OverviewSegmentsCard } from "@/features/overview/view/OverviewSegmentsCard"
import { OverviewTrafficCard } from "@/features/overview/view/OverviewTrafficCard"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"

type OverviewDashboardProps = {
  data: OverviewDashboardData
  projectId: string
}

function valueSuffixForMetric(id: OverviewKpiMetricId): string | undefined {
  if (id === "fsr" || id === "bounce-rate") return "%"
  return undefined
}

function funnelStepsFromApiPayload(
  payload: FunnelDashboardData
): OverviewFunnelStep[] {
  return payload.metrics.map((metric) => ({
    label: metric.label,
    value: metric.value,
    change: metric.change,
    changeVariant: metric.changeVariant,
  }))
}

export function OverviewDashboard({ data, projectId }: OverviewDashboardProps) {
  const { dateRangeId, setDateRangeId } = useDashboardDateRange()
  const [activeKpiId, setActiveKpiId] = useState<OverviewKpiMetricId>(
    data.defaultKpiMetricId
  )
  const [funnelSteps, setFunnelSteps] = useState<OverviewFunnelStep[]>(
    data.funnel
  )
  const [isFunnelLoading, setIsFunnelLoading] = useState(false)
  const [chartNowNonce, setChartNowNonce] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setChartNowNonce((n) => n + 1)
    }, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const fetchFunnelForRange = useCallback(
    async (rangeId: typeof dateRangeId, signal?: AbortSignal) => {
      setIsFunnelLoading(true)

      const url = `/api/landing-pages/${encodeURIComponent(projectId)}/funnel?range_id=${encodeURIComponent(rangeId)}`
      try {
        const res = await fetch(url, { cache: "no-store", signal })
        if (!res.ok) return
        const payload = (await res.json()) as FunnelDashboardData
        setFunnelSteps(funnelStepsFromApiPayload(payload))
      } catch (err) {
        if (signal?.aborted) return
        if (process.env.NODE_ENV === "development") {
          console.error("[overview] funnel fetch failed", err)
        }
      } finally {
        if (!signal?.aborted) {
          setIsFunnelLoading(false)
        }
      }
    },
    [projectId]
  )

  useEffect(() => {
    if (dateRangeId === data.defaultDateRangeId) {
      setFunnelSteps(data.funnel)
      setIsFunnelLoading(false)
      return
    }

    const controller = new AbortController()
    void fetchFunnelForRange(dateRangeId, controller.signal)
    return () => controller.abort()
  }, [dateRangeId, data, fetchFunnelForRange])

  const chartPoints = useMemo(() => {
    void chartNowNonce
    const fromApi = data.kpiSeriesByDateRange?.[dateRangeId]?.[activeKpiId]
    if (fromApi !== undefined && fromApi.length > 0) {
      return fromApi
    }
    return overviewChartPointsForRange(dateRangeId, new Date())
  }, [data.kpiSeriesByDateRange, dateRangeId, activeKpiId, chartNowNonce])

  const kpis = useMemo(
    () => overviewKpisForDateRange(data, dateRangeId),
    [data, dateRangeId]
  )

  const activeKpiLabel = useMemo(() => {
    return overviewKpiLabelsForFormType(data.formType)[activeKpiId]
  }, [data.formType, activeKpiId])

  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        overviewRechartsPointerFocusResetClassName
      )}
    >
      <OverviewHeader
        title="Overview"
        dateRangeOptions={data.dateRangeOptions}
        dateRangeId={dateRangeId}
        onDateRangeChange={setDateRangeId}
      />

      <OverviewKpiRow
        kpis={kpis}
        activeKpiId={activeKpiId}
        onKpiSelect={setActiveKpiId}
      />

      <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-[3fr_7fr] lg:items-stretch lg:[&>*]:min-h-0">
        <div
          className={cn(isFunnelLoading && "pointer-events-none opacity-60")}
          aria-busy={isFunnelLoading}
        >
          <OverviewFunnelCard steps={funnelSteps} />
        </div>
        <OverviewPerformanceChart
          points={chartPoints}
          metricLabel={activeKpiLabel}
          valueSuffix={valueSuffixForMetric(activeKpiId)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch lg:[&>*]:min-h-0">
        <div className="flex min-h-0 flex-col gap-4">
          <OverviewTrafficCard stats={data.traffic} />
          <OverviewSegmentsCard segments={data.segments} />
        </div>
        <OverviewAlertsCard alerts={data.alerts} />
      </div>
    </div>
  )
}
