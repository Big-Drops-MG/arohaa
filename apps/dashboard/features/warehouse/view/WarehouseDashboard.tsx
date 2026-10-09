import type { ComponentType, ReactNode } from "react"
import { Activity, AtSign, MousePointerClick, ShieldAlert } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { dashboardPageInsetClassName } from "@/features/overview/view/overview-card-density"
import type {
  WarehouseDashboardData,
  WarehouseDomainCount,
  WarehouseNameCount,
} from "@/lib/server/warehouse-load"
import { formatDashboardDateTime } from "@/lib/datetime"
import { getEventDisplayName } from "@/features/warehouse/model/event-display-names"

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString("en-US")
}

function Panel({
  title,
  description,
  icon: Icon,
  children,
  className,
  bodyClassName,
}: {
  title: string
  description?: string
  icon?: ComponentType<{ className?: string }>
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-background",
        className
      )}
    >
      <header className="shrink-0 border-b border-border px-5 py-4">
        <div className="flex items-start gap-3">
          {Icon ? (
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
              <Icon className="size-4" aria-hidden />
            </div>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </header>
      <div className={cn("min-h-0 flex-1 px-5 py-4", bodyClassName)}>
        {children}
      </div>
    </section>
  )
}

function StatCard({
  label,
  value,
  hint,
  tone = "default",
  compact = false,
}: {
  label: string
  value: string
  hint?: string
  tone?: "default" | "legit" | "fraud"
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-xl border",
        compact ? "px-4 py-3.5" : "px-5 py-5",
        tone === "default" && "border-border bg-background",
        tone === "legit" && "border-emerald-200 bg-emerald-50/50",
        tone === "fraud" && "border-rose-200 bg-rose-50/50"
      )}
    >
      <p
        className={cn(
          "text-[11px] font-medium tracking-wide uppercase",
          tone === "legit" && "text-emerald-800",
          tone === "fraud" && "text-rose-800",
          tone === "default" && "text-muted-foreground"
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-semibold tracking-tight tabular-nums",
          compact ? "text-2xl" : "mt-3 text-3xl",
          tone === "legit" && "text-emerald-950",
          tone === "fraud" && "text-rose-950",
          tone === "default" && "text-foreground"
        )}
      >
        {value}
      </p>
      {hint ? (
        <p
          className={cn(
            "mt-auto pt-1.5 text-xs leading-relaxed",
            tone === "legit" && "text-emerald-800/75",
            tone === "fraud" && "text-rose-800/75",
            tone === "default" && "text-muted-foreground"
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  )
}

function CountTable({
  rows,
  nameHeader,
  empty,
}: {
  rows: WarehouseNameCount[]
  nameHeader: string
  empty: string
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>
  }

  const max = Math.max(...rows.map((row) => row.count), 1)

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border text-left">
          <th className="pb-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {nameHeader}
          </th>
          <th className="pr-1 pb-2.5 text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Count
          </th>
          <th className="hidden w-2/5 pb-2.5 pl-4 sm:table-cell">
            <span className="sr-only">Share</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.name}
            className="border-b border-border/60 last:border-0"
          >
            <td className="py-2.5 pr-4 align-top font-medium text-foreground">
              {getEventDisplayName(row.name)}
            </td>
            <td className="py-2.5 pr-1 text-right align-top font-semibold text-foreground tabular-nums">
              {formatCount(row.count)}
            </td>
            <td className="hidden py-2.5 pl-4 align-middle sm:table-cell">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground/70"
                  style={{
                    width: `${Math.max(4, Math.round((row.count / max) * 100))}%`,
                  }}
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DomainTable({ rows }: { rows: WarehouseDomainCount[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No lead emails found yet.</p>
    )
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border text-left">
          <th className="pb-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Domain
          </th>
          <th className="pb-2.5 text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Total
          </th>
          <th className="pb-2.5 text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Legit
          </th>
          <th className="pr-1 pb-2.5 text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Fraud
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.domain}
            className="border-b border-border/60 last:border-0"
          >
            <td className="py-2.5 pr-4 font-medium text-foreground">
              @{row.domain}
            </td>
            <td className="py-2.5 text-right font-semibold text-foreground tabular-nums">
              {formatCount(row.count)}
            </td>
            <td className="py-2.5 text-right text-emerald-700 tabular-nums">
              {formatCount(row.legit)}
            </td>
            <td className="py-2.5 pr-1 text-right text-rose-700 tabular-nums">
              {formatCount(row.fraud)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ScrollBody({ children }: { children: ReactNode }) {
  return (
    <div className="max-h-80 overflow-y-auto overscroll-contain pr-4">
      {children}
    </div>
  )
}

export function WarehouseDashboard({ data }: { data: WarehouseDashboardData }) {
  const summary = data.summary

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-360 space-y-10 py-8",
        dashboardPageInsetClassName
      )}
    >
      <header className="flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Internal
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Warehouse
          </h1>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Global Arohaa inventory — traffic, leads, and trust.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Synced{" "}
          <span className="font-medium text-foreground tabular-nums">
            {formatDashboardDateTime(data.fetchedAt)}
          </span>
        </p>
      </header>

      {data.error || !summary ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          {data.error ?? "Warehouse data is unavailable."}
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Traffic
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Total events"
                value={formatCount(summary.totals.events)}
                hint={`${formatCount(summary.volume.last24h)} in the last 24 hours`}
              />
              <StatCard
                label="Sessions"
                value={formatCount(summary.totals.sessions)}
                hint={`${formatCount(summary.totals.visitors)} unique visitors`}
              />
              <StatCard
                label="Form submits"
                value={formatCount(summary.totals.formSubmits)}
                hint={`${formatCount(summary.totals.formStarts)} starts · ${formatCount(summary.totals.formSuccesses)} successes`}
              />
              <StatCard
                label="Click events"
                value={formatCount(summary.clicks.total)}
                hint={`${formatCount(summary.volume.last7d)} events over 7 days`}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Lead trust
            </h2>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
              <div className="flex flex-col gap-4">
                <StatCard
                  label="Legit"
                  value={formatCount(summary.risk.legit)}
                  hint="Trust score 50–100"
                  tone="legit"
                  compact
                />
                <StatCard
                  label="Fraud"
                  value={formatCount(summary.risk.fraud)}
                  hint="Trust score below 50"
                  tone="fraud"
                  compact
                />
              </div>
              <Panel
                title="Why fraud"
                description={
                  summary.risk.fraud > 0
                    ? `${formatCount(summary.risk.fraud)} leads flagged`
                    : "No fraud leads yet"
                }
                icon={ShieldAlert}
                bodyClassName="pt-3"
              >
                {summary.fraudReasons.length > 0 ? (
                  <ScrollBody>
                    <ul className="space-y-2.5">
                      {summary.fraudReasons.map((row) => (
                        <li
                          key={row.name}
                          className="flex items-start justify-between gap-4 text-sm"
                        >
                          <span className="min-w-0 leading-snug text-foreground">
                            {row.name}
                          </span>
                          <span className="shrink-0 font-semibold text-rose-700 tabular-nums">
                            {formatCount(row.count)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </ScrollBody>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {summary.risk.fraud > 0
                      ? "Reason details are not available yet."
                      : "No fraud signals recorded."}
                  </p>
                )}
                {summary.risk.unscoredFormSubmits > 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {formatCount(summary.risk.unscoredFormSubmits)} sessions
                    could not be scored.
                  </p>
                ) : null}
              </Panel>
            </div>
          </section>

          <section className="grid items-stretch gap-4 lg:grid-cols-2">
            <Panel
              title="Email domains"
              description="Lead emails with legit / fraud split"
              icon={AtSign}
            >
              <ScrollBody>
                <DomainTable rows={summary.emailDomains} />
              </ScrollBody>
            </Panel>
            <Panel
              title="Click breakdown"
              description="Button, link, heatmap, call, and service"
              icon={MousePointerClick}
            >
              <ScrollBody>
                <CountTable
                  rows={summary.clicks.byName}
                  nameHeader="Type"
                  empty="No click events recorded yet."
                />
              </ScrollBody>
            </Panel>
          </section>

          <Panel
            title="All events"
            description="Full event_name inventory"
            icon={Activity}
          >
            <ScrollBody>
              <CountTable
                rows={summary.eventsByName}
                nameHeader="Event"
                empty="No events in ClickHouse yet."
              />
            </ScrollBody>
          </Panel>
        </>
      )}
    </div>
  )
}
