import type { ComponentType, ReactNode } from "react"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  HardDrive,
  Layers,
  Radio,
  Server,
  XCircle,
} from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import type {
  OpsDashboardData,
  OpsDependencyStatus,
  OpsEndpointCheck,
  OpsEndpointGroup,
  OpsFailedItem,
  OpsQueueItem,
} from "@/lib/server/ops-dashboard-load"
import { OpsAutoRefresh } from "@/features/ops/view/OpsAutoRefresh"
import { formatDashboardDateTime } from "@/lib/datetime"

type HealthLevel = "healthy" | "degraded" | "critical" | "unknown"

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0 || d > 0) parts.push(`${h}h`)
  parts.push(`${m}m`)
  return parts.join(" ")
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString("en-US")
}

function isOkStatus(status: OpsDependencyStatus | string | undefined): boolean {
  return status === "ok"
}

function resolveOverallHealth(data: OpsDashboardData): {
  level: HealthLevel
  title: string
  detail: string
} {
  const detailed = data.detailed
  const ready = data.ready
  const failedDepth =
    data.queues?.failed_events.depth ?? detailed?.queues.failed_events ?? 0
  const queueDepth =
    data.queues?.analytics_queue.depth ?? detailed?.queues.analytics_queue ?? 0

  const depDown = detailed
    ? [
        detailed.dependencies.clickhouse.status,
        detailed.dependencies.redis.status,
        detailed.dependencies.postgres.status,
      ].some((s) => !isOkStatus(s))
    : ready
      ? [
          ready.dependencies.clickhouse,
          ready.dependencies.redis,
          ready.dependencies.postgres,
        ].some((s) => !isOkStatus(s))
      : Boolean(data.detailedError || data.readyError)

  const serviceDown =
    (detailed && detailed.status !== "ok") || (ready && ready.status !== "ok")

  if (!detailed && !ready && (data.detailedError || data.readyError)) {
    return {
      level: "critical",
      title: "Unable to reach ingestion health APIs",
      detail:
        data.detailedError ||
        data.readyError ||
        "Health endpoints did not respond. Verify INGEST_BASE_URL and API availability.",
    }
  }

  if (depDown || serviceDown) {
    return {
      level: "critical",
      title: "Pipeline unhealthy",
      detail:
        "One or more core dependencies are down, or the API readiness check failed. Investigate ClickHouse, Redis, and Postgres first.",
    }
  }

  if (failedDepth > 0) {
    return {
      level: "degraded",
      title: "Dead-letter queue has failed events",
      detail: `${failedDepth.toLocaleString()} item${failedDepth === 1 ? "" : "s"} in failed_events need attention. Live ingestion may still be running.`,
    }
  }

  if (queueDepth > 500) {
    return {
      level: "degraded",
      title: "Analytics queue is backing up",
      detail: `${queueDepth.toLocaleString()} events are waiting in analytics_queue. Check worker throughput and ClickHouse insert latency.`,
    }
  }

  return {
    level: "healthy",
    title: "All monitored systems look healthy",
    detail:
      "Dependencies are reachable, readiness is OK, and the dead-letter queue is clear.",
  }
}

function StatusBadge({
  tone,
  label,
}: {
  tone: "ok" | "warn" | "down" | "neutral"
  label: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-md border px-2 text-[11px] leading-none font-semibold tracking-wide whitespace-nowrap",
        tone === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "warn" && "border-amber-200 bg-amber-50 text-amber-900",
        tone === "down" && "border-red-200 bg-red-50 text-red-800",
        tone === "neutral" &&
          "border-neutral-200 bg-neutral-100 text-neutral-700"
      )}
    >
      {label}
    </span>
  )
}

function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string
  description: string
  icon: ComponentType<{ className?: string }>
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs",
        className
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
            <Icon className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-950">{title}</h2>
            <p className="mt-0.5 text-sm text-neutral-500">{description}</p>
          </div>
        </div>
        {action}
      </header>
      <div className="flex-1 px-5 py-4 sm:px-6">{children}</div>
    </section>
  )
}

function KpiTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string
  value: string
  hint: string
  tone?: "ok" | "warn" | "down" | "neutral"
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
          {label}
        </p>
        {tone !== "neutral" ? (
          <StatusBadge
            tone={tone}
            label={tone === "ok" ? "OK" : tone === "warn" ? "Watch" : "Alert"}
          />
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950 tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500">{hint}</p>
    </div>
  )
}

function LatencyBar({ ms, maxMs = 500 }: { ms: number; maxMs?: number }) {
  const pct = Math.min(100, Math.round((ms / maxMs) * 100))
  const tone =
    ms < 80 ? "bg-emerald-500" : ms < 200 ? "bg-amber-500" : "bg-red-500"
  return (
    <div className="flex min-w-28 flex-col items-end gap-1">
      <span className="text-xs font-medium text-neutral-700 tabular-nums">
        {ms} ms
      </span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          className={cn("h-full rounded-full", tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function MemoryBar({ usedMb, totalMb }: { usedMb: number; totalMb: number }) {
  const pct =
    totalMb > 0 ? Math.min(100, Math.round((usedMb / totalMb) * 100)) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-500">Heap usage</span>
        <span className="font-medium text-neutral-900 tabular-nums">
          {usedMb} / {totalMb} MB ({pct}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
        <div
          className={cn(
            "h-full rounded-full",
            pct < 70
              ? "bg-neutral-900"
              : pct < 85
                ? "bg-amber-500"
                : "bg-red-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function DependencyCard({
  name,
  detail,
  readyLabel,
  description,
}: {
  name: string
  detail?: { status: OpsDependencyStatus; latency_ms: number }
  readyLabel?: OpsDependencyStatus
  description: string
}) {
  const status = detail?.status ?? readyLabel ?? "unknown"
  const ok = isOkStatus(status)
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-950">{name}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
            {description}
          </p>
        </div>
        <StatusBadge
          tone={ok ? "ok" : "down"}
          label={ok ? "OK" : String(status)}
        />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs text-neutral-500">Round-trip latency</span>
        {detail ? (
          <LatencyBar ms={detail.latency_ms} />
        ) : (
          <span className="text-xs text-neutral-400">Not available</span>
        )}
      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-100 py-2.5 last:border-0">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="text-sm font-medium text-neutral-900 tabular-nums">
        {value}
      </span>
    </div>
  )
}

function formatPrettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

function JsonDisclosure({ json }: { json: string }) {
  const pretty = formatPrettyJson(json)

  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs font-medium text-neutral-600 hover:text-neutral-950">
        View raw payload
      </summary>
      <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-neutral-200 bg-neutral-50 p-3 font-mono text-[11px] leading-relaxed wrap-break-word whitespace-pre-wrap text-neutral-800">
        {pretty}
      </pre>
    </details>
  )
}

function FailedEventsList({ items }: { items: OpsFailedItem[] }) {
  return (
    <ul className="max-h-112 space-y-3 overflow-y-auto overscroll-contain pr-1">
      {items.map((item, idx) => (
        <li
          key={`${item.timestamp ?? "t"}-${idx}`}
          className="rounded-lg border border-red-100 bg-red-50/40 p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusBadge tone="down" label={item.reason || "failed"} />
            <span className="text-xs text-neutral-500 tabular-nums">
              {item.timestamp
                ? formatDashboardDateTime(item.timestamp)
                : "Unknown time"}
            </span>
          </div>
          <JsonDisclosure json={item.json} />
        </li>
      ))}
    </ul>
  )
}

function QueueSampleList({ items }: { items: OpsQueueItem[] }) {
  return (
    <ul className="max-h-112 space-y-3 overflow-y-auto overscroll-contain pr-1">
      {items.map((item, idx) => (
        <li
          key={`${item.created_at ?? "c"}-${idx}`}
          className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-neutral-950">
              {item.event_name ?? "queued event"}
            </span>
            <span className="text-xs text-neutral-500 tabular-nums">
              {item.created_at ? formatDashboardDateTime(item.created_at) : ""}
            </span>
          </div>
          {item.workspace_id ? (
            <p className="mt-1 font-mono text-[11px] text-neutral-500">
              workspace {item.workspace_id}
            </p>
          ) : null}
          {item.url ? (
            <p className="mt-0.5 truncate font-mono text-[11px] text-neutral-500">
              {item.url}
            </p>
          ) : null}
          <JsonDisclosure json={item.json} />
        </li>
      ))}
    </ul>
  )
}

function endpointTone(
  check: OpsEndpointCheck
): "ok" | "warn" | "down" | "neutral" {
  if (!check.reachable || check.httpStatus === null) return "down"
  if (check.httpStatus < 300) return "ok"
  if (check.httpStatus < 500) return "warn"
  return "down"
}

function EndpointGroupCard({ group }: { group: OpsEndpointGroup }) {
  const ok = group.checks.filter(
    (c) => c.reachable && c.httpStatus !== null && c.httpStatus < 500
  ).length
  const total = group.checks.length

  return (
    <SectionCard
      title={`${group.title} probes`}
      description={`Reachability checks against ${group.baseLabel}.`}
      icon={Radio}
      action={
        <StatusBadge
          tone={ok === total ? "ok" : ok === 0 ? "down" : "warn"}
          label={`${ok}/${total} reachable`}
        />
      }
    >
      {group.checks.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No endpoint checks available.
        </p>
      ) : (
        <div className="max-h-112 overflow-auto overscroll-contain">
          <table className="w-full min-w-160 border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-neutral-200 text-left text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
                <th className="border-b border-neutral-200 bg-white py-2.5 pr-3 font-semibold">
                  Endpoint
                </th>
                <th className="border-b border-neutral-200 bg-white py-2.5 pr-3 font-semibold">
                  Method
                </th>
                <th className="border-b border-neutral-200 bg-white py-2.5 pr-3 font-semibold">
                  Path
                </th>
                <th className="border-b border-neutral-200 bg-white py-2.5 pr-3 text-right font-semibold">
                  Latency
                </th>
                <th className="border-b border-neutral-200 bg-white py-2.5 pl-2 text-right font-semibold">
                  HTTP
                </th>
              </tr>
            </thead>
            <tbody>
              {group.checks.map((check) => (
                <tr
                  key={`${check.method}-${check.path}`}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="py-3 pr-3 align-middle font-medium text-neutral-950">
                    {check.name}
                  </td>
                  <td className="py-3 pr-3 align-middle text-neutral-500">
                    {check.method}
                  </td>
                  <td className="py-3 pr-3 align-middle font-mono text-xs text-neutral-500">
                    {check.path}
                  </td>
                  <td className="py-3 pr-3 text-right align-middle text-neutral-600 tabular-nums">
                    {check.latencyMs} ms
                  </td>
                  <td className="py-3 pl-2 align-middle">
                    <div className="flex justify-end">
                      <StatusBadge
                        tone={endpointTone(check)}
                        label={
                          check.httpStatus === null
                            ? "No response"
                            : String(check.httpStatus)
                        }
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

type OpsDashboardProps = {
  data: OpsDashboardData
}

export function OpsDashboard({ data }: OpsDashboardProps) {
  const health = resolveOverallHealth(data)
  const detailed = data.detailed
  const ready = data.ready
  const metrics = data.metrics
  const queues = data.queues

  const failedDepth =
    queues?.failed_events.depth ?? detailed?.queues.failed_events ?? 0
  const queueDepth =
    queues?.analytics_queue.depth ?? detailed?.queues.analytics_queue ?? 0
  const eventsHour = metrics?.events.last_hour ?? 0
  const eventsDay = metrics?.events.last_24h ?? 0
  const eventsTotal = metrics?.events.total ?? 0

  const HealthIcon =
    health.level === "healthy"
      ? CheckCircle2
      : health.level === "degraded"
        ? AlertTriangle
        : health.level === "critical"
          ? XCircle
          : Activity

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            Operations
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950">
            Ingestion & infrastructure monitor
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-neutral-500">
            Live health for the ingest API, dependencies, queue depths, event
            volume, and endpoint reachability
            {data.apiBase ? (
              <>
                {" "}
                from{" "}
                <span className="font-mono text-neutral-700">
                  {data.apiBase}
                </span>
              </>
            ) : null}
            . Snapshot taken {formatDashboardDateTime(data.fetchedAt)}.
          </p>
        </div>
        <OpsAutoRefresh />
      </div>

      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border px-4 py-4 sm:px-5",
          health.level === "healthy" &&
            "border-emerald-200 bg-emerald-50/70 text-emerald-950",
          health.level === "degraded" &&
            "border-amber-200 bg-amber-50/80 text-amber-950",
          health.level === "critical" &&
            "border-red-200 bg-red-50/80 text-red-950",
          health.level === "unknown" &&
            "border-neutral-200 bg-neutral-50 text-neutral-900"
        )}
      >
        <HealthIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{health.title}</p>
          <p className="mt-0.5 text-sm leading-relaxed opacity-90">
            {health.detail}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiTile
          label="System"
          value={
            detailed?.status === "ok" || ready?.status === "ok"
              ? "Healthy"
              : detailed || ready
                ? "Degraded"
                : "Unknown"
          }
          hint="Combined status from /health/detailed and /health/ready."
          tone={
            detailed?.status === "ok" || ready?.status === "ok"
              ? "ok"
              : detailed || ready
                ? "down"
                : "neutral"
          }
        />
        <KpiTile
          label="Events · 1h"
          value={metrics ? formatCount(eventsHour) : "—"}
          hint="ClickHouse events ingested in the last hour."
        />
        <KpiTile
          label="Events · 24h"
          value={metrics ? formatCount(eventsDay) : "—"}
          hint="ClickHouse events ingested in the last 24 hours."
        />
        <KpiTile
          label="Queue depth"
          value={formatCount(queueDepth)}
          hint="Events waiting in Redis analytics_queue."
          tone={queueDepth > 500 ? "warn" : queueDepth > 0 ? "neutral" : "ok"}
        />
        <KpiTile
          label="Dead letters"
          value={formatCount(failedDepth)}
          hint="Failed events in the DLQ that need replay or inspection."
          tone={failedDepth > 0 ? "down" : "ok"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Infrastructure dependencies"
          description="ClickHouse stores analytics, Redis backs queues, Postgres holds app state."
          icon={Database}
        >
          {data.detailedError && !detailed ? (
            <p className="text-sm text-red-700">{data.detailedError}</p>
          ) : (
            <div className="grid gap-3">
              <DependencyCard
                name="ClickHouse"
                description="Analytics warehouse for events, rollups, and reporting queries."
                detail={detailed?.dependencies.clickhouse}
                readyLabel={ready?.dependencies.clickhouse}
              />
              <DependencyCard
                name="Redis"
                description="Queue broker for analytics_queue and failed_events dead-letter storage."
                detail={detailed?.dependencies.redis}
                readyLabel={ready?.dependencies.redis}
              />
              <DependencyCard
                name="Postgres"
                description="Primary application database for landing pages, auth, and settings."
                detail={detailed?.dependencies.postgres}
                readyLabel={ready?.dependencies.postgres}
              />
              {ready ? (
                <p className="pt-1 text-xs text-neutral-500">
                  Readiness probe latency {ready.latency_ms} ms · checked{" "}
                  {formatDashboardDateTime(ready.timestamp)}
                </p>
              ) : data.readyError ? (
                <p className="text-sm text-red-700">{data.readyError}</p>
              ) : null}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="API runtime"
          description="Process identity and memory pressure for the ingest service."
          icon={Server}
        >
          {data.detailedError && !detailed ? (
            <p className="text-sm text-red-700">{data.detailedError}</p>
          ) : detailed ? (
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-950">
                    {detailed.service}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {detailed.environment} · {detailed.region}
                  </p>
                </div>
                <StatusBadge
                  tone={detailed.status === "ok" ? "ok" : "down"}
                  label={detailed.status === "ok" ? "OK" : detailed.status}
                />
              </div>
              <MetaRow label="Version" value={detailed.version} />
              <MetaRow label="Uptime" value={formatUptime(detailed.uptime_s)} />
              <MetaRow label="Node.js" value={detailed.system.node} />
              <MetaRow label="PID" value={String(detailed.system.pid)} />
              <MetaRow
                label="RSS memory"
                value={`${detailed.system.memory_rss_mb} MB`}
              />
              <div className="pt-3">
                <MemoryBar
                  usedMb={detailed.system.memory_heap_used_mb}
                  totalMb={detailed.system.memory_heap_total_mb}
                />
              </div>
              <p className="mt-3 text-xs text-neutral-500">
                Reported {formatDashboardDateTime(detailed.timestamp)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">
              Detailed runtime metrics are unavailable.
            </p>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Event volume"
          description="Ingested event counts from ClickHouse via /health/metrics."
          icon={Activity}
        >
          {data.metricsError && !metrics ? (
            <p className="text-sm text-red-700">{data.metricsError}</p>
          ) : metrics ? (
            <div>
              <MetaRow
                label="All-time events"
                value={formatCount(eventsTotal)}
              />
              <MetaRow label="Last hour" value={formatCount(eventsHour)} />
              <MetaRow label="Last 24 hours" value={formatCount(eventsDay)} />
              <MetaRow
                label="Queue (metrics)"
                value={String(metrics.queues.analytics_queue)}
              />
              <MetaRow
                label="DLQ (metrics)"
                value={String(metrics.queues.failed_events)}
              />
              <p className="mt-3 text-xs text-neutral-500">
                Metrics snapshot {formatDashboardDateTime(metrics.timestamp)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">
              Event volume metrics are unavailable.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title="Queue depths"
          description="Redis list sizes for live ingestion backlog and dead letters."
          icon={Layers}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50/70 p-4">
              <div className="flex items-center gap-2 text-neutral-500">
                <HardDrive className="size-3.5" aria-hidden />
                <span className="text-xs font-semibold tracking-wide uppercase">
                  analytics_queue
                </span>
              </div>
              <p className="mt-2 text-3xl font-semibold text-neutral-950 tabular-nums">
                {formatCount(queueDepth)}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                Events waiting to be written into ClickHouse by the worker.
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50/70 p-4">
              <div className="flex items-center gap-2 text-neutral-500">
                <AlertTriangle className="size-3.5" aria-hidden />
                <span className="text-xs font-semibold tracking-wide uppercase">
                  failed_events
                </span>
              </div>
              <p className="mt-2 text-3xl font-semibold text-neutral-950 tabular-nums">
                {formatCount(failedDepth)}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                Dead-letter items that failed processing and need review.
              </p>
            </div>
          </div>
          {ready ? (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500">
              <Clock3 className="size-3.5" aria-hidden />
              Ready check latency {ready.latency_ms} ms
            </p>
          ) : null}
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Dead-letter queue (failed_events)"
          description={
            queues
              ? `Showing up to ${queues.limit} of ${queues.failed_events.depth} failed items for triage.`
              : "Inspect failed ingestion payloads and failure reasons."
          }
          icon={AlertTriangle}
          action={
            <StatusBadge
              tone={failedDepth > 0 ? "down" : "ok"}
              label={failedDepth > 0 ? `${failedDepth} pending` : "Clear"}
            />
          }
        >
          {data.queuesError && !queues ? (
            <p className="text-sm text-red-700">{data.queuesError}</p>
          ) : queues && queues.failed_events.sample.length > 0 ? (
            <FailedEventsList items={queues.failed_events.sample} />
          ) : (
            <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50/60 px-4 py-8 text-center">
              <CheckCircle2 className="mx-auto size-5 text-emerald-600" />
              <p className="mt-2 text-sm font-medium text-neutral-900">
                DLQ is empty
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                No failed events are waiting. New failures will appear here with
                reason and payload.
              </p>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Live backlog (analytics_queue)"
          description={
            queues
              ? `Showing up to ${queues.limit} of ${queues.analytics_queue.depth} queued events.`
              : "Sample of events currently waiting for ingestion."
          }
          icon={Layers}
          action={
            <StatusBadge
              tone={queueDepth > 500 ? "warn" : "neutral"}
              label={queueDepth > 0 ? `${queueDepth} waiting` : "Empty"}
            />
          }
        >
          {data.queuesError && !queues ? (
            <p className="text-sm text-red-700">{data.queuesError}</p>
          ) : queues && queues.analytics_queue.sample.length > 0 ? (
            <QueueSampleList items={queues.analytics_queue.sample} />
          ) : (
            <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50/60 px-4 py-8 text-center">
              <CheckCircle2 className="mx-auto size-5 text-emerald-600" />
              <p className="mt-2 text-sm font-medium text-neutral-900">
                Queue is drained
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Events are being processed in real time. A growing backlog
                usually means the worker or ClickHouse is slow.
              </p>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="space-y-6">
        {data.endpointGroups.map((group) => (
          <EndpointGroupCard key={group.title} group={group} />
        ))}
      </div>
    </div>
  )
}
