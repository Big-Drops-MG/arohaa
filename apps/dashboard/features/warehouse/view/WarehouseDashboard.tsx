import type { ComponentType, ReactNode } from "react"
import {
  Activity,
  AtSign,
  Keyboard,
  MousePointerClick,
  ShieldAlert,
  Users,
} from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { dashboardPageInsetClassName } from "@/features/overview/view/overview-card-density"
import { LeadRiskBadge } from "@/features/data-export/view/LeadRiskBadge"
import {
  discoverVisibleLeadFieldKeys,
  humanizeLeadFieldLabel,
} from "@/features/data-export/model/lead-field-columns"
import type {
  WarehouseDashboardData,
  WarehouseDomainCount,
  WarehouseNameCount,
  WarehouseShortcutCount,
  WarehouseShortcutLead,
} from "@/lib/server/warehouse-load"
import {
  formatDashboardDateTime,
  formatInDashboardTimezone,
  getDashboardTimezoneAbbreviation,
} from "@/lib/datetime"
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

function formatShortcutPercent(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0%"
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`
}

function ShortcutTable({
  rows,
  formSessions,
}: {
  rows: WarehouseShortcutCount[]
  formSessions: number
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No shortcut usage recorded yet.
      </p>
    )
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border text-left">
          <th className="pb-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Shortcut
          </th>
          <th className="pb-2.5 text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Sessions
          </th>
          <th className="pr-1 pb-2.5 text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
            % of form sessions
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.name}
            className="border-b border-border/60 last:border-0"
          >
            <td className="py-2.5 pr-4 font-medium text-foreground">
              {row.label}
            </td>
            <td className="py-2.5 text-right font-semibold text-foreground tabular-nums">
              {formatCount(row.sessions)}
            </td>
            <td className="py-2.5 pr-1 text-right font-semibold text-foreground tabular-nums">
              {formatShortcutPercent(row.percent)}
            </td>
          </tr>
        ))}
      </tbody>
      {formSessions > 0 ? (
        <tfoot>
          <tr>
            <td colSpan={3} className="pt-3 text-xs text-muted-foreground">
              Based on {formatCount(formSessions)} form-start sessions
            </td>
          </tr>
        </tfoot>
      ) : null}
    </table>
  )
}

function formatWhen(value: string): string {
  if (!value) return "—"
  const d = new Date(
    value.includes("T") ? value : value.replace(" ", "T") + "Z"
  )
  if (Number.isNaN(d.getTime())) return value
  const formatted = formatInDashboardTimezone(d, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
  return `${formatted} ${getDashboardTimezoneAbbreviation(d)}`
}

function cellValue(value: string | undefined): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : "—"
}

function shortId(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return "—"
  if (trimmed.length <= 12) return trimmed
  return `${trimmed.slice(0, 8)}…`
}

const leadThClassName =
  "px-3 py-2.5 text-left text-xs font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase"
const leadTdClassName =
  "px-3 py-2.5 align-middle text-sm whitespace-nowrap text-foreground"

function shortcutLabel(lead: WarehouseShortcutLead): string {
  if (lead.usedCopy && lead.usedPaste) return "Copy + Paste"
  if (lead.usedCopy) return "Copy (Ctrl+C)"
  if (lead.usedPaste) return "Paste (Ctrl+V)"
  return "—"
}

function ShortcutLeadsTable({ rows }: { rows: WarehouseShortcutLead[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No Copy/Paste shortcut users yet. Percentages need updated SDK traffic.
      </p>
    )
  }

  const fieldKeys = discoverVisibleLeadFieldKeys(rows)

  return (
    <table className="w-max min-w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className={leadThClassName}>#</th>
          <th className={leadThClassName}>When</th>
          <th className={leadThClassName}>Shortcut</th>
          <th className={leadThClassName}>Trust</th>
          <th className={leadThClassName}>First Name</th>
          <th className={leadThClassName}>Last Name</th>
          <th className={leadThClassName}>Email</th>
          <th className={leadThClassName}>Zip</th>
          <th className={leadThClassName}>UTM Source</th>
          <th className={leadThClassName}>UTM ID</th>
          <th className={leadThClassName}>TrustedForm</th>
          <th className={leadThClassName}>Form Submitted</th>
          {fieldKeys.map((key) => (
            <th key={key} className={leadThClassName}>
              {humanizeLeadFieldLabel(key)}
            </th>
          ))}
          <th className={leadThClassName}>MAC ID</th>
          <th className={leadThClassName}>Session</th>
          <th className={leadThClassName}>Workspace</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((lead, index) => (
          <tr
            key={`${lead.workspaceId}:${lead.sessionId}`}
            className="border-b border-border/60 last:border-0"
          >
            <td
              className={cn(
                leadTdClassName,
                "text-muted-foreground tabular-nums"
              )}
            >
              {index + 1}
            </td>
            <td className={leadTdClassName}>{formatWhen(lead.createdAt)}</td>
            <td className={leadTdClassName}>{shortcutLabel(lead)}</td>
            <td className={leadTdClassName}>
              <LeadRiskBadge fraud={lead.fraud} />
            </td>
            <td className={leadTdClassName}>
              {cellValue(lead.firstName || lead.fields.first_name)}
            </td>
            <td className={leadTdClassName}>
              {cellValue(lead.lastName || lead.fields.last_name)}
            </td>
            <td className={leadTdClassName}>{cellValue(lead.email)}</td>
            <td className={leadTdClassName}>{cellValue(lead.zip)}</td>
            <td className={leadTdClassName}>{cellValue(lead.utmSource)}</td>
            <td className={leadTdClassName}>{cellValue(lead.utmId)}</td>
            <td
              className={cn(
                leadTdClassName,
                "max-w-[12rem] min-w-[8rem] whitespace-normal"
              )}
            >
              {lead.trustedFormUrl ? (
                <a
                  href={lead.trustedFormUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium break-all text-sky-700 underline-offset-2 hover:underline"
                >
                  View certificate
                </a>
              ) : (
                "—"
              )}
            </td>
            <td className={leadTdClassName}>
              <span
                className={cn(
                  "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                  lead.formSubmitted
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-neutral-100 text-neutral-600"
                )}
              >
                {lead.formSubmitted ? "Yes" : "No"}
              </span>
            </td>
            {fieldKeys.map((key) => (
              <td
                key={key}
                className={cn(
                  leadTdClassName,
                  "max-w-[14rem] whitespace-normal text-muted-foreground"
                )}
              >
                {cellValue(lead.fields[key])}
              </td>
            ))}
            <td
              className={cn(
                leadTdClassName,
                "font-mono text-xs text-muted-foreground"
              )}
            >
              {cellValue(lead.macId)}
            </td>
            <td
              className={cn(
                leadTdClassName,
                "font-mono text-xs text-muted-foreground"
              )}
              title={lead.sessionId}
            >
              {shortId(lead.sessionId)}
            </td>
            <td className={leadTdClassName} title={lead.workspaceId}>
              {cellValue(lead.workspaceName || lead.workspaceId)}
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
        "mx-auto w-full max-w-360 min-w-0 space-y-10 py-8",
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
            title="Form shortcuts"
            description="Share of form sessions using Copy and Paste shortcuts"
            icon={Keyboard}
          >
            <ShortcutTable
              rows={summary.shortcuts?.byName ?? []}
              formSessions={summary.shortcuts?.formSessions ?? 0}
            />
          </Panel>

          <Panel
            title="Copy / Paste users"
            description={
              (summary.shortcutLeads?.length ?? 0) > 0
                ? `${formatCount(summary.shortcutLeads.length)} sessions that used Ctrl+C or Ctrl+V — full lead form fields`
                : "Sessions that used Ctrl+C or Ctrl+V — full lead form fields"
            }
            icon={Users}
            className="min-w-0"
            bodyClassName="min-w-0 px-0 py-0"
          >
            <div className="max-h-[28rem] min-w-0 overflow-x-auto overflow-y-auto overscroll-contain px-5 py-4">
              <ShortcutLeadsTable rows={summary.shortcutLeads ?? []} />
            </div>
          </Panel>

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
