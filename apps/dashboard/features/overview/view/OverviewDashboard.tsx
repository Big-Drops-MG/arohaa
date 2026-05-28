"use client"

import { useEffect, useMemo, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import {
  overviewKpiLabelsForFormType,
  type OverviewDashboardData,
  type OverviewDateRangeId,
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

type OverviewDashboardProps = {
  data: OverviewDashboardData
}

function valueSuffixForMetric(id: OverviewKpiMetricId): string | undefined {
  if (id === "fsr" || id === "bounce-rate") return "%"
  return undefined
}

export function OverviewDashboard({ data }: OverviewDashboardProps) {
  const [dateRangeId, setDateRangeId] = useState<OverviewDateRangeId>(
    data.defaultDateRangeId
  )
  const [activeKpiId, setActiveKpiId] = useState<OverviewKpiMetricId>(
    data.defaultKpiMetricId
  )

  const [chartNowNonce, setChartNowNonce] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setChartNowNonce((n) => n + 1)
    }, 60_000)
    return () => window.clearInterval(id)
  }, [])

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
        <OverviewFunnelCard steps={data.funnel} />
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
