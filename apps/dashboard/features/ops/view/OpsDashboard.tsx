import { cn } from "@workspace/ui/lib/utils"
import type { OpsDashboardData } from "@/lib/server/ops-dashboard-load"
import { SettingsSectionCard } from "@/features/settings/view/SettingsSectionCard"

function StatusPill({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        ok
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
      )}
    >
      {ok ? "OK" : "Down"}
    </span>
  )
}

function MetricRow({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground tabular-nums">{value}</span>
    </div>
  )
}

type OpsDashboardProps = {
  data: OpsDashboardData
}

export function OpsDashboard({ data }: OpsDashboardProps) {
  const readyOk = data.ready?.status === "ok"

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Ops
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live ingestion pipeline health from {data.apiBase || "API"}. Refreshed{" "}
          {new Date(data.fetchedAt).toLocaleString()}.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SettingsSectionCard
          title="Service readiness"
          description="Dependencies and Redis queue depths from /health/ready."
        >
          {data.readyError ? (
            <p className="text-sm text-destructive">{data.readyError}</p>
          ) : data.ready ? (
            <div className="space-y-1">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">API</span>
                <StatusPill ok={readyOk} />
              </div>
              <MetricRow
                label="ClickHouse"
                value={data.ready.dependencies.clickhouse}
              />
              <MetricRow label="Redis" value={data.ready.dependencies.redis} />
              <MetricRow
                label="Postgres"
                value={data.ready.dependencies.postgres}
              />
              <MetricRow
                label="analytics_queue"
                value={data.ready.queues.analytics_queue}
              />
              <MetricRow
                label="failed_events"
                value={data.ready.queues.failed_events}
              />
              <MetricRow
                label="Latency"
                value={`${data.ready.latency_ms} ms`}
              />
            </div>
          ) : null}
        </SettingsSectionCard>

        <SettingsSectionCard
          title="Event volume"
          description="ClickHouse totals from /health/metrics."
        >
          {data.metricsError ? (
            <p className="text-sm text-destructive">{data.metricsError}</p>
          ) : data.metrics ? (
            <div className="space-y-1">
              <MetricRow
                label="Events (total)"
                value={data.metrics.events.total.toLocaleString()}
              />
              <MetricRow
                label="Last hour"
                value={data.metrics.events.last_hour.toLocaleString()}
              />
              <MetricRow
                label="Last 24h"
                value={data.metrics.events.last_24h.toLocaleString()}
              />
              <MetricRow
                label="analytics_queue"
                value={data.metrics.queues.analytics_queue}
              />
              <MetricRow
                label="failed_events"
                value={data.metrics.queues.failed_events}
              />
            </div>
          ) : null}
        </SettingsSectionCard>
      </div>
    </div>
  )
}
