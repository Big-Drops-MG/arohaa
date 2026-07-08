import { cn } from "@workspace/ui/lib/utils"
import type {
  OpsDashboardData,
  OpsEndpointCheck,
} from "@/lib/server/ops-dashboard-load"
import { SettingsSectionCard } from "@/features/settings/view/SettingsSectionCard"
import { OpsAutoRefresh } from "@/features/ops/view/OpsAutoRefresh"

type PillTone = "ok" | "up" | "down"

function StatusPill({ tone, label }: { tone: PillTone; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "ok" &&
          "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
        tone === "up" &&
          "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
        tone === "down" &&
          "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
      )}
    >
      {label}
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

function DependencyRow({
  label,
  status,
  latencyMs,
}: {
  label: string
  status: string
  latencyMs: number
}) {
  const ok = status === "ok"
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground tabular-nums">
          {latencyMs} ms
        </span>
        <StatusPill tone={ok ? "ok" : "down"} label={ok ? "OK" : "Down"} />
      </div>
    </div>
  )
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  parts.push(`${m}m`)
  return parts.join(" ")
}

function endpointTone(check: OpsEndpointCheck): PillTone {
  if (!check.reachable) return "down"
  if (check.httpStatus !== null && check.httpStatus < 300) return "ok"
  return "up"
}

function endpointLabel(check: OpsEndpointCheck): string {
  if (check.httpStatus === null) return "No response"
  return String(check.httpStatus)
}

function EndpointTable({ checks }: { checks: OpsEndpointCheck[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs tracking-wide text-muted-foreground uppercase dark:border-neutral-800">
            <th className="py-2 pr-4 font-medium">Endpoint</th>
            <th className="py-2 pr-4 font-medium">Method</th>
            <th className="hidden py-2 pr-4 font-medium sm:table-cell">Path</th>
            <th className="py-2 pr-4 text-right font-medium">Latency</th>
            <th className="py-2 text-right font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => (
            <tr
              key={`${check.method}-${check.path}`}
              className="border-b border-neutral-100 last:border-0 dark:border-neutral-900"
            >
              <td className="py-2 pr-4 font-medium text-foreground">
                {check.name}
              </td>
              <td className="py-2 pr-4 text-muted-foreground">
                {check.method}
              </td>
              <td className="hidden py-2 pr-4 font-mono text-xs text-muted-foreground sm:table-cell">
                {check.path}
              </td>
              <td className="py-2 pr-4 text-right text-muted-foreground tabular-nums">
                {check.latencyMs} ms
              </td>
              <td className="py-2 text-right">
                <StatusPill
                  tone={endpointTone(check)}
                  label={endpointLabel(check)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type OpsDashboardProps = {
  data: OpsDashboardData
}

export function OpsDashboard({ data }: OpsDashboardProps) {
  const readyOk = data.ready?.status === "ok"
  const detailed = data.detailed

  const okCount = data.endpointGroups
    .flatMap((g) => g.checks)
    .filter((c) => c.reachable).length
  const totalCount = data.endpointGroups.flatMap((g) => g.checks).length

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Ops
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live ingestion pipeline health from {data.apiBase || "API"}.
            Refreshed {new Date(data.fetchedAt).toLocaleString()}.
          </p>
        </div>
        <OpsAutoRefresh />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SettingsSectionCard
          title="System"
          description="Runtime internals from /health/detailed."
        >
          {data.detailedError ? (
            <p className="text-sm text-destructive">{data.detailedError}</p>
          ) : detailed ? (
            <div className="space-y-1">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">Service</span>
                <StatusPill
                  tone={detailed.status === "ok" ? "ok" : "down"}
                  label={detailed.status === "ok" ? "OK" : "Degraded"}
                />
              </div>
              <MetricRow label="Version" value={detailed.version} />
              <MetricRow label="Environment" value={detailed.environment} />
              <MetricRow label="Region" value={detailed.region} />
              <MetricRow
                label="Uptime"
                value={formatUptime(detailed.uptime_s)}
              />
              <MetricRow label="Node" value={detailed.system.node} />
              <MetricRow label="PID" value={detailed.system.pid} />
              <MetricRow
                label="Memory (RSS)"
                value={`${detailed.system.memory_rss_mb} MB`}
              />
              <MetricRow
                label="Heap used"
                value={`${detailed.system.memory_heap_used_mb} / ${detailed.system.memory_heap_total_mb} MB`}
              />
            </div>
          ) : null}
        </SettingsSectionCard>

        <SettingsSectionCard
          title="Dependencies"
          description="Per-dependency status and response time from /health/detailed."
        >
          {data.detailedError ? (
            <p className="text-sm text-destructive">{data.detailedError}</p>
          ) : detailed ? (
            <div className="space-y-1">
              <DependencyRow
                label="ClickHouse"
                status={detailed.dependencies.clickhouse.status}
                latencyMs={detailed.dependencies.clickhouse.latency_ms}
              />
              <DependencyRow
                label="Redis"
                status={detailed.dependencies.redis.status}
                latencyMs={detailed.dependencies.redis.latency_ms}
              />
              <DependencyRow
                label="Postgres"
                status={detailed.dependencies.postgres.status}
                latencyMs={detailed.dependencies.postgres.latency_ms}
              />
              <MetricRow
                label="analytics_queue"
                value={detailed.queues.analytics_queue}
              />
              <MetricRow
                label="failed_events"
                value={detailed.queues.failed_events}
              />
            </div>
          ) : null}
        </SettingsSectionCard>

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
                <StatusPill
                  tone={readyOk ? "ok" : "down"}
                  label={readyOk ? "OK" : "Down"}
                />
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

      {data.endpointGroups.map((group) => (
        <SettingsSectionCard
          key={group.title}
          title={`${group.title} endpoints`}
          description={`Lightweight reachability probe of ${group.baseLabel}. ${okCount}/${totalCount} endpoints reachable across all groups.`}
        >
          {group.checks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No endpoint checks available.
            </p>
          ) : (
            <EndpointTable checks={group.checks} />
          )}
        </SettingsSectionCard>
      ))}
    </div>
  )
}
