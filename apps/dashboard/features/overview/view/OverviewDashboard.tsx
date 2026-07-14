"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { cn } from "@workspace/ui/lib/utils"
import type { AlertsDashboardData } from "@/features/alerts/model/alerts"
import type { FunnelDashboardData } from "@/features/funnel/model/funnel"
import {
  overviewKpiLabelsForFormType,
  type OverviewAlert,
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
import {
  overviewStaggerContainer,
  overviewStaggerItem,
} from "@/features/overview/view/overview-motion"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"
import {
  buildAnalyticsApiPath,
  shouldUseInitialTabData,
} from "@/lib/dashboard/analytics-query"

type OverviewDashboardProps = {
  data: OverviewDashboardData
  projectId: string
}

function valueSuffixForMetric(id: OverviewKpiMetricId): string | undefined {
  if (id === "fsr" || id === "bounce-rate") return "%"
  return undefined
}

const OVERVIEW_SERIES_METRICS: readonly OverviewKpiMetricId[] = [
  "visitors",
  "sessions",
  "page-views",
  "form-submitted",
  "fsr",
  "bounce-rate",
]

function hasCompleteKpiSeries(
  data: OverviewDashboardData,
  rangeId: OverviewDashboardData["defaultDateRangeId"]
): boolean {
  const series = data.kpiSeriesByDateRange?.[rangeId]
  return OVERVIEW_SERIES_METRICS.every(
    (metricId) => (series?.[metricId]?.length ?? 0) > 0
  )
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
  const reduceMotion = useReducedMotion()
  const { dateRangeId, setDateRangeId } = useDashboardDateRange()
  const { utmFilter } = useDashboardUtmFilter()
  const [overviewData, setOverviewData] = useState(data)
  const [activeKpiId, setActiveKpiId] = useState<OverviewKpiMetricId>(
    data.defaultKpiMetricId
  )
  const [funnelSteps, setFunnelSteps] = useState<OverviewFunnelStep[]>(
    data.funnel
  )
  const [alerts, setAlerts] = useState<OverviewAlert[]>(data.alerts)
  const [isFunnelLoading, setIsFunnelLoading] = useState(false)
  const [chartNowNonce, setChartNowNonce] = useState(0)

  useEffect(() => {
    setOverviewData(data)
    setFunnelSteps(data.funnel)
    setAlerts(data.alerts)
  }, [data])

  useEffect(() => {
    if (
      shouldUseInitialTabData(
        dateRangeId,
        data.defaultDateRangeId,
        utmFilter
      ) &&
      hasCompleteKpiSeries(data, dateRangeId)
    ) {
      setOverviewData(data)
      return
    }

    const controller = new AbortController()
    const url = buildAnalyticsApiPath(
      `/api/landing-pages/${encodeURIComponent(projectId)}/overview`,
      { rangeId: dateRangeId, utmFilter }
    )

    void fetch(url, { cache: "no-store", signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!payload) return
        setOverviewData(payload as OverviewDashboardData)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        if (process.env.NODE_ENV === "development") {
          console.error("[overview] overview fetch failed", err)
        }
      })

    return () => controller.abort()
  }, [data, projectId, dateRangeId, utmFilter])

  useEffect(() => {
    let cancelled = false
    const url = buildAnalyticsApiPath(
      `/api/landing-pages/${encodeURIComponent(projectId)}/alerts`,
      { rangeId: dateRangeId, utmFilter }
    )

    void fetch(url, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (cancelled || !payload) return
        const apiAlerts = (payload as AlertsDashboardData).items
        setAlerts((prev) => {
          const builtIn = prev.filter((item) => item.id === "no-events-24h")
          return [...apiAlerts, ...builtIn]
        })
      })
      .catch((err) => {
        if (process.env.NODE_ENV === "development") {
          console.error("[overview] alerts fetch failed", err)
        }
      })

    return () => {
      cancelled = true
    }
  }, [projectId, dateRangeId, utmFilter])

  useEffect(() => {
    const id = window.setInterval(() => {
      setChartNowNonce((n) => n + 1)
    }, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const fetchFunnelForRange = useCallback(
    async (rangeId: typeof dateRangeId, signal?: AbortSignal) => {
      setIsFunnelLoading(true)

      const url = buildAnalyticsApiPath(
        `/api/landing-pages/${encodeURIComponent(projectId)}/funnel`,
        { rangeId, utmFilter }
      )
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
    [projectId, utmFilter]
  )

  useEffect(() => {
    if (
      shouldUseInitialTabData(dateRangeId, data.defaultDateRangeId, utmFilter)
    ) {
      setFunnelSteps(data.funnel)
      setIsFunnelLoading(false)
      return
    }

    const controller = new AbortController()
    void fetchFunnelForRange(dateRangeId, controller.signal)
    return () => controller.abort()
  }, [dateRangeId, utmFilter, data, fetchFunnelForRange])

  const chartPoints = useMemo(() => {
    void chartNowNonce
    const fromApi =
      overviewData.kpiSeriesByDateRange?.[dateRangeId]?.[activeKpiId]
    if (fromApi !== undefined && fromApi.length > 0) {
      return fromApi
    }
    return overviewChartPointsForRange(dateRangeId, new Date())
  }, [
    overviewData.kpiSeriesByDateRange,
    dateRangeId,
    activeKpiId,
    chartNowNonce,
  ])

  const kpis = useMemo(
    () => overviewKpisForDateRange(overviewData, dateRangeId),
    [overviewData, dateRangeId]
  )

  const activeKpiLabel = useMemo(() => {
    return overviewKpiLabelsForFormType(overviewData.formType)[activeKpiId]
  }, [overviewData.formType, activeKpiId])

  const chartKey = `${dateRangeId}-${activeKpiId}`

  return (
    <motion.div
      variants={overviewStaggerContainer}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      className={cn(
        "flex flex-col gap-5 px-6 pb-6 lg:px-8",
        overviewRechartsPointerFocusResetClassName
      )}
    >
      <motion.div variants={overviewStaggerItem}>
        <OverviewHeader
          title="Overview"
          dateRangeOptions={data.dateRangeOptions}
          dateRangeId={dateRangeId}
          onDateRangeChange={setDateRangeId}
        />
      </motion.div>

      <motion.div variants={overviewStaggerItem}>
        <OverviewKpiRow
          kpis={kpis}
          activeKpiId={activeKpiId}
          onKpiSelect={setActiveKpiId}
        />
      </motion.div>

      <motion.div
        variants={overviewStaggerItem}
        className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-[3fr_7fr] lg:items-stretch lg:[&>*]:min-h-0"
      >
        <motion.div
          animate={{ opacity: isFunnelLoading ? 0.55 : 1 }}
          transition={{ duration: 0.2 }}
          className={cn("min-h-0", isFunnelLoading && "pointer-events-none")}
          aria-busy={isFunnelLoading}
        >
          <OverviewFunnelCard steps={funnelSteps} />
        </motion.div>
        <OverviewPerformanceChart
          points={chartPoints}
          metricLabel={activeKpiLabel}
          valueSuffix={valueSuffixForMetric(activeKpiId)}
          chartKey={chartKey}
        />
      </motion.div>

      <motion.div
        variants={overviewStaggerItem}
        className="grid gap-4 lg:grid-cols-2 lg:items-stretch lg:[&>*]:min-h-0"
      >
        <div className="flex min-h-0 flex-col gap-4">
          <OverviewTrafficCard stats={overviewData.traffic} />
          <OverviewSegmentsCard segments={overviewData.segments} />
        </div>
        <OverviewAlertsCard alerts={alerts} />
      </motion.div>
    </motion.div>
  )
}
