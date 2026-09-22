"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { buildAnalyticsApiPath } from "@/lib/dashboard/analytics-query"
import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import type { DashboardCustomRange } from "@/features/traffic/model/traffic-range"
import type {
  NotificationCenterAnalyticsData,
  NotificationCenterDashboardData,
} from "@/features/notification-center/model/notification-center"
import { getNotificationCenterAnalyticsEmpty } from "@/features/notification-center/controller/notification-center-analytics-empty"
import { NotificationCenterStatsSkeleton } from "@/features/dashboard/view/dashboard-skeletons"
import { TrafficExpandableCard } from "@/features/traffic/view/TrafficExpandableCard"

type NotificationCenterStatsTabProps = {
  projectId: string
  shell: NotificationCenterDashboardData
  dateRangeId: OverviewDateRangeId
  customRange: DashboardCustomRange | null
  campaignId: string
  busy?: boolean
  onFlushRequest?: () => void
  canFlush?: boolean
}

function pctLabel(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

function formatMs(ms: number | null): string {
  if (ms == null) return "—"
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  return `${(ms / 3_600_000).toFixed(1)}h`
}

function computeChartYMax(values: number[]): number {
  const max = Math.max(0, ...values)
  if (max <= 0) return 4
  const padded = max * 1.15
  if (padded <= 4) return 4
  if (padded <= 12) return Math.ceil(padded)
  if (padded <= 100) return Math.ceil(padded / 5) * 5
  if (padded <= 500) return Math.ceil(padded / 25) * 25
  if (padded <= 2500) return Math.ceil(padded / 100) * 100
  return Math.ceil(padded / 500) * 500
}

function KpiTile({
  label,
  value,
  hint,
  active,
  onClick,
}: {
  label: string
  value: string
  hint: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[15px] border px-4 py-3.5 text-left shadow-xs transition-colors",
        active
          ? "border-black bg-black text-white"
          : "border-foreground/10 bg-card text-foreground hover:border-neutral-300 hover:bg-neutral-50/80"
      )}
    >
      <p
        className={cn(
          "text-xs font-medium",
          active ? "text-white/80" : "text-muted-foreground"
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 font-heading text-xl font-semibold tracking-tight tabular-nums",
          active ? "text-white" : "text-foreground"
        )}
      >
        {value}
      </p>
      <p
        className={cn(
          "mt-1 text-[11px] leading-snug",
          active ? "text-white/70" : "text-muted-foreground"
        )}
      >
        {hint}
      </p>
    </button>
  )
}

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-xs">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3 sm:px-5">
        <div className="min-w-0 space-y-0.5">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  )
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "clicked" || status === "sent" || status === "active"
      ? "bg-emerald-50 text-emerald-700"
      : status === "failed" || status === "cancelled"
        ? "bg-red-50 text-red-700"
        : "bg-neutral-100 text-neutral-600"
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase",
        tone
      )}
    >
      {status}
    </span>
  )
}

export function NotificationCenterStatsTab({
  projectId,
  shell,
  dateRangeId,
  customRange,
  campaignId,
  busy = false,
  onFlushRequest,
  canFlush = false,
}: NotificationCenterStatsTabProps) {
  const [data, setData] = useState<NotificationCenterAnalyticsData>(() =>
    getNotificationCenterAnalyticsEmpty(dateRangeId)
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartMetric, setChartMetric] = useState<"sends" | "subs">("sends")
  const [hasLoaded, setHasLoaded] = useState(false)

  const fetchAnalytics = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      setError(null)
      try {
        const path = buildAnalyticsApiPath(
          `/api/landing-pages/${encodeURIComponent(projectId)}/notification-center/analytics`,
          {
            rangeId: dateRangeId,
            customRange,
            extra:
              campaignId !== "all" ? { campaign_id: campaignId } : undefined,
          }
        )
        const res = await fetch(path, { cache: "no-store", signal })
        if (!res.ok) throw new Error(`Analytics failed (${res.status})`)
        const json = (await res.json()) as NotificationCenterAnalyticsData
        setData(json)
        setHasLoaded(true)
      } catch (err) {
        if (signal?.aborted) return
        setError(err instanceof Error ? err.message : "Analytics failed")
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [campaignId, customRange, dateRangeId, projectId]
  )

  useEffect(() => {
    const controller = new AbortController()
    void fetchAnalytics(controller.signal)
    return () => controller.abort()
  }, [fetchAnalytics])

  const chartData = useMemo(() => {
    return [...data.series]
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((p) => ({
        day: p.day,
        label: p.label,
        sent: p.sent,
        clicked: p.clicked,
        failed: p.failed,
        newActive: p.newActive,
        churned: p.churned,
      }))
  }, [data.series])

  const chartYMax = useMemo(() => {
    if (chartMetric === "sends") {
      return computeChartYMax(
        chartData.flatMap((p) => [p.sent, p.clicked, p.failed])
      )
    }
    return computeChartYMax(chartData.flatMap((p) => [p.newActive, p.churned]))
  }, [chartData, chartMetric])

  const chartHasActivity = useMemo(() => {
    if (chartMetric === "sends") {
      return chartData.some((p) => p.sent + p.clicked + p.failed > 0)
    }
    return chartData.some((p) => p.newActive + p.churned > 0)
  }, [chartData, chartMetric])

  const showAllXTicks = chartData.length <= 10
  const angledXAxis = chartData.length > 8
  const showDots = chartData.length <= 14
  const chartMargins = {
    top: 8,
    right: 12,
    left: 0,
    bottom: angledXAxis ? 36 : 8,
  } as const

  const maxFunnel = Math.max(1, ...data.funnel.map((s) => s.value))

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {data.warnings.map((w) => (
        <div
          key={w}
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          {w}
        </div>
      ))}

      {!hasLoaded && loading ? (
        <NotificationCenterStatsSkeleton />
      ) : (
        <div
          className={cn(
            "flex flex-col gap-4 transition-opacity",
            loading && "opacity-80"
          )}
          aria-busy={loading}
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiTile
              label="Active subs"
              value={String(data.kpis.activeSubs)}
              hint={`+${data.kpis.newSubs} / −${data.kpis.churnedSubs} in range`}
              active={chartMetric === "subs"}
              onClick={() => setChartMetric("subs")}
            />
            <KpiTile
              label="Sent"
              value={String(data.kpis.sent)}
              hint="Includes clicked deliveries"
              active={chartMetric === "sends"}
              onClick={() => setChartMetric("sends")}
            />
            <KpiTile
              label="CTR"
              value={pctLabel(data.kpis.ctr)}
              hint={`${data.kpis.clicked} clicks · median ${formatMs(data.kpis.medianTimeToClickMs)}`}
            />
            <KpiTile
              label="Fail rate"
              value={pctLabel(data.kpis.failRate)}
              hint={`${data.kpis.failed} failed · ${data.kpis.cancelled} cancelled`}
            />
            <KpiTile
              label="Displayed"
              value={String(data.kpis.displayed)}
              hint={
                data.kpis.displayed > 0
                  ? `Engaged CTR ${pctLabel(data.kpis.engagedCtr)}`
                  : "Needs SW display beacon"
              }
            />
            <KpiTile
              label="Conversions"
              value={String(data.kpis.attributedConversions)}
              hint={`CVR ${pctLabel(data.kpis.attributedCvr)} · 24h after click`}
            />
          </div>

          {data.insights.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {data.insights.map((insight) => (
                <div
                  key={insight.id}
                  className={cn(
                    "rounded-xl border px-3.5 py-3",
                    insight.tone === "positive" &&
                      "border-emerald-200 bg-emerald-50/70",
                    insight.tone === "warning" &&
                      "border-amber-200 bg-amber-50/70",
                    insight.tone === "neutral" &&
                      "border-neutral-200 bg-neutral-50/70"
                  )}
                >
                  <p className="text-sm font-semibold text-foreground">
                    {insight.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {insight.detail}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          <Panel
            title={chartMetric === "sends" ? "Sends & clicks" : "Audience"}
            description={
              chartMetric === "sends"
                ? dateRangeId === "all_time"
                  ? "Sent, clicked, and failed since this landing was added"
                  : "Daily sent, clicked, and failed deliveries"
                : dateRangeId === "all_time"
                  ? "Opt-ins and churn since this landing was added"
                  : "New opt-ins vs churned subscriptions"
            }
          >
            <div className="relative h-64 w-full">
              {!chartHasActivity ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70">
                  <p className="text-sm text-muted-foreground">
                    No activity in this range
                  </p>
                </div>
              ) : null}
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={chartMargins}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e5e5e5"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#737373" }}
                    tickLine={false}
                    axisLine={{ stroke: "#e5e5e5" }}
                    interval={showAllXTicks ? 0 : "equidistantPreserveStart"}
                    minTickGap={showAllXTicks ? 4 : 24}
                    angle={angledXAxis ? -32 : 0}
                    textAnchor={angledXAxis ? "end" : "middle"}
                    height={angledXAxis ? 52 : 28}
                    padding={{ left: 8, right: 8 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, chartYMax]}
                    tickCount={5}
                    width={36}
                    tick={{ fontSize: 11, fill: "#737373" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      borderColor: "#e5e5e5",
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={28}
                    wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
                  />
                  {chartMetric === "sends" ? (
                    <>
                      <Line
                        type="monotone"
                        dataKey="sent"
                        name="Sent"
                        stroke="#171717"
                        strokeWidth={2}
                        dot={showDots ? { r: 2.5, strokeWidth: 0 } : false}
                        activeDot={{ r: 4 }}
                        isAnimationActive={chartData.length > 1}
                      />
                      <Line
                        type="monotone"
                        dataKey="clicked"
                        name="Clicked"
                        stroke="#0284c7"
                        strokeWidth={2}
                        dot={showDots ? { r: 2.5, strokeWidth: 0 } : false}
                        activeDot={{ r: 4 }}
                        isAnimationActive={chartData.length > 1}
                      />
                      <Line
                        type="monotone"
                        dataKey="failed"
                        name="Failed"
                        stroke="#dc2626"
                        strokeWidth={2}
                        dot={showDots ? { r: 2.5, strokeWidth: 0 } : false}
                        activeDot={{ r: 4 }}
                        isAnimationActive={chartData.length > 1}
                      />
                    </>
                  ) : (
                    <>
                      <Line
                        type="monotone"
                        dataKey="newActive"
                        name="New"
                        stroke="#059669"
                        strokeWidth={2}
                        dot={showDots ? { r: 2.5, strokeWidth: 0 } : false}
                        activeDot={{ r: 4 }}
                        isAnimationActive={chartData.length > 1}
                      />
                      <Line
                        type="monotone"
                        dataKey="churned"
                        name="Churned"
                        stroke="#d97706"
                        strokeWidth={2}
                        dot={showDots ? { r: 2.5, strokeWidth: 0 } : false}
                        activeDot={{ r: 4 }}
                        isAnimationActive={chartData.length > 1}
                      />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel
              title="Delivery funnel"
              description="Queued volume vs successful sends and clicks"
            >
              <div className="space-y-3">
                {data.funnel.map((step) => (
                  <div key={step.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">
                        {step.label}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {step.value}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full bg-neutral-900"
                        style={{
                          width: `${Math.max(
                            step.value > 0 ? 4 : 0,
                            (step.value / maxFunnel) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              title="Push → click → convert"
              description="Attributed LP conversions within 24h of click"
            >
              <div className="space-y-3">
                {data.conversionFunnel.map((step) => {
                  const max = Math.max(
                    1,
                    ...data.conversionFunnel.map((s) => s.value)
                  )
                  return (
                    <div key={step.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">
                          {step.label}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {step.value}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className="h-full rounded-full bg-sky-700"
                          style={{
                            width: `${
                              step.value > 0
                                ? Math.max(4, (step.value / max) * 100)
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Panel>
          </div>

          <Panel
            title="Campaign leaderboard"
            description="Performance in the selected range"
          >
            {data.campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No campaign activity in this range.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-150 border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 text-left text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
                      <th className="px-2 py-2">Campaign</th>
                      <th className="px-2 py-2">Sent</th>
                      <th className="px-2 py-2">CTR</th>
                      <th className="px-2 py-2">Fail</th>
                      <th className="px-2 py-2">Conv</th>
                      <th className="px-2 py-2">CVR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.campaigns.map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-neutral-50 last:border-0"
                      >
                        <td className="px-2 py-2.5 font-medium text-foreground">
                          {c.name}
                          {!c.maskedRedirect ? (
                            <span className="ml-2 text-[10px] font-normal text-amber-700">
                              unmasked
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2.5 tabular-nums">{c.sent}</td>
                        <td className="px-2 py-2.5 tabular-nums">
                          {pctLabel(c.ctr)}
                        </td>
                        <td className="px-2 py-2.5 tabular-nums">{c.failed}</td>
                        <td className="px-2 py-2.5 tabular-nums">
                          {c.conversions}
                        </td>
                        <td className="px-2 py-2.5 tabular-nums">
                          {pctLabel(c.cvr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="Failures" description="Top failure reasons">
              {data.failures.length === 0 ? (
                <p className="text-sm text-muted-foreground">No failures.</p>
              ) : (
                <ul className="space-y-2">
                  {data.failures.map((f) => (
                    <li
                      key={f.key}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 break-all text-foreground">
                        {f.label}
                      </span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {f.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel
              title="Cancels"
              description="Queued sends cancelled by event"
            >
              {data.cancels.length === 0 ? (
                <p className="text-sm text-muted-foreground">No cancels.</p>
              ) : (
                <ul className="space-y-2">
                  {data.cancels.map((f) => (
                    <li
                      key={f.key}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 text-foreground">{f.label}</span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {f.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Segments" description="CTR by UTM source">
              {data.segments.byUtmSource.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No segment data.
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.segments.byUtmSource.slice(0, 8).map((s) => (
                    <li
                      key={s.key}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 truncate text-foreground">
                        {s.label}
                      </span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {s.sent} · {pctLabel(s.ctr)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {data.dripSteps.length > 0 ? (
            <Panel
              title="Drip steps"
              description="Per-step send and click performance"
            >
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {data.dripSteps.map((step) => (
                  <div
                    key={step.step}
                    className="rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-3"
                  >
                    <p className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">
                      Step {step.step + 1}
                    </p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">
                      {step.sent} sent · {pctLabel(step.ctr)} CTR
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Lifetime shell: {shell.stats.activeSubscriptions} active subs ·{" "}
              {shell.stats.sentCount} lifetime sends. Lists below are
              range-filtered.
            </p>
            {onFlushRequest ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || !canFlush}
                className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                onClick={onFlushRequest}
              >
                Flush subscriptions & deliveries
              </Button>
            ) : null}
          </div>

          <div className="grid items-stretch gap-4 xl:grid-cols-2">
            <TrafficExpandableCard
              title="Subscriptions"
              className="h-full"
              dialogClassName="max-w-2xl"
              expandedContent={
                <div className="divide-y divide-neutral-100">
                  {data.subscriptions.map((sub) => (
                    <div key={sub.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-mono text-xs">{sub.endpointHash}</p>
                        <StatusBadge status={sub.status} />
                      </div>
                      <p className="mt-1 truncate text-[11px] text-neutral-500">
                        {sub.lastSeenUrl || sub.origin || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              }
            >
              <section className="flex h-full min-h-72 flex-col overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-xs">
                <div className="border-b border-neutral-100 px-4 py-3">
                  <h3 className="text-sm font-semibold">Subscriptions</h3>
                  <p className="text-xs text-muted-foreground">
                    Recent endpoints for this landing page
                  </p>
                </div>
                <div className="divide-y divide-neutral-100 overflow-y-auto">
                  {data.subscriptions.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No subscriptions yet.
                    </p>
                  ) : (
                    data.subscriptions.slice(0, 8).map((sub) => (
                      <div key={sub.id} className="px-4 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-mono text-xs">
                            {sub.endpointHash}
                          </p>
                          <StatusBadge status={sub.status} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </TrafficExpandableCard>

            <TrafficExpandableCard
              title="Recent deliveries"
              className="h-full"
              dialogClassName="max-w-2xl"
              expandedContent={
                <div className="divide-y divide-neutral-100">
                  {data.recentDeliveries.map((d) => (
                    <div key={d.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="truncate text-xs font-medium">
                          {d.campaignName}
                        </p>
                        <StatusBadge status={d.status} />
                      </div>
                      <p className="mt-1 text-[11px] text-neutral-500">
                        {d.clickedAt
                          ? `Clicked ${new Date(d.clickedAt).toLocaleString()}`
                          : d.sentAt
                            ? `Sent ${new Date(d.sentAt).toLocaleString()}`
                            : `Scheduled ${new Date(d.scheduledFor).toLocaleString()}`}
                      </p>
                    </div>
                  ))}
                </div>
              }
            >
              <section className="flex h-full min-h-72 flex-col overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-xs">
                <div className="border-b border-neutral-100 px-4 py-3">
                  <h3 className="text-sm font-semibold">Recent deliveries</h3>
                  <p className="text-xs text-muted-foreground">
                    Latest sends, clicks, and failures in range
                  </p>
                </div>
                <div className="divide-y divide-neutral-100 overflow-y-auto">
                  {data.recentDeliveries.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No deliveries in this range.
                    </p>
                  ) : (
                    data.recentDeliveries.slice(0, 8).map((d) => (
                      <div key={d.id} className="px-4 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <p className="truncate text-xs font-medium">
                            {d.campaignName}
                          </p>
                          <StatusBadge status={d.status} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </TrafficExpandableCard>
          </div>
        </div>
      )}
    </div>
  )
}
