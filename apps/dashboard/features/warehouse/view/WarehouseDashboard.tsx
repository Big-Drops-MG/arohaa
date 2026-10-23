import type { ComponentType, ReactNode } from "react"
import {
  Activity,
  AtSign,
  Keyboard,
  MousePointerClick,
  ShieldAlert,
} from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { dashboardPageInsetClassName } from "@/features/overview/view/overview-card-density"
import type {
  WarehouseDashboardData,
  WarehouseDomainCount,
  WarehouseNameCount,
  WarehouseShortcutCount,
} from "@/lib/server/warehouse-load"
import { formatDashboardDateTime } from "@/lib/datetime"
import { getEventDisplayName } from "@/features/warehouse/model/event-display-names"
import { PartnerScorecardsPanel } from "@/features/warehouse/view/PartnerScorecardsPanel"
import { UtmSourceTrustPanel } from "@/features/warehouse/view/UtmSourceTrustPanel"
import { WarehouseLeadReviewSection } from "@/features/warehouse/view/WarehouseLeadReviewSection"

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
            Lower risk
          </th>
          <th className="pr-1 pb-2.5 text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Elevated
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
            Global Arohaa inventory — traffic, leads, and trust. Lead review is
            limited to Superadmin and CEO.
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
              Traffic quality
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
                label="Visits (7d)"
                value={formatCount(
                  summary.trafficQuality?.visits ?? summary.totals.sessions
                )}
                hint={
                  summary.trafficQuality?.assessmentStatus === "unavailable"
                    ? `${formatCount(summary.trafficQuality?.nonSubmitVisits ?? 0)} non-submit · visit assessment unavailable`
                    : summary.trafficQuality?.assessmentStatus ===
                        "not_assessed"
                      ? `${formatCount(summary.trafficQuality?.nonSubmitVisits ?? 0)} non-submit · visits not assessed yet`
                      : `${formatCount(summary.trafficQuality?.nonSubmitVisits ?? 0)} non-submit · ${formatCount(summary.trafficQuality?.suspiciousVisits ?? 0)} suspicious of ${formatCount(summary.trafficQuality?.assessedVisits ?? 0)} assessed`
                }
              />
              <StatCard
                label="Form submits"
                value={formatCount(summary.totals.formSubmits)}
                hint={`${formatCount(summary.totals.formStarts)} starts · ${formatCount(summary.totals.formSuccesses)} successes`}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Suspicious-visit indicators are administrator evidence only.
              Landing-page arrivals alone do not establish that paid ad clicks
              were fraudulent.
            </p>
          </section>

          <WarehouseLeadReviewSection
            submissions={summary.quality?.submissions ?? 0}
            elevatedRisk={
              summary.quality?.flagged ?? summary.risk.elevatedRisk ?? 0
            }
            incompleteAssessments={
              summary.quality?.incompleteAssessments ??
              summary.risk.insufficientData ??
              0
            }
            relatedContactGroups={summary.quality?.relatedContactGroups ?? 0}
            pendingReviews={summary.quality?.pendingReviews ?? 0}
            shortcutLeads={summary.shortcutLeads ?? []}
          />

          <section className="space-y-3">
            <h2 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Lead assessment
            </h2>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
              <div className="flex flex-col gap-4">
                <StatCard
                  label="Lower risk"
                  value={formatCount(
                    summary.risk.lowerRisk ?? summary.risk.legit
                  )}
                  hint="Trust score 50–100 when coverage allows"
                  tone="legit"
                  compact
                />
                <StatCard
                  label="Elevated risk"
                  value={formatCount(
                    summary.risk.elevatedRisk ?? summary.risk.fraud
                  )}
                  hint="Trust score below 50 — not an auto-reject"
                  tone="fraud"
                  compact
                />
              </div>
              <Panel
                title="Top findings"
                description={
                  (summary.risk.elevatedRisk ?? summary.risk.fraud) > 0
                    ? `${formatCount(summary.risk.elevatedRisk ?? summary.risk.fraud)} elevated-risk assessments`
                    : "No elevated-risk assessments yet"
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
                    No assessment findings recorded yet.
                  </p>
                )}
              </Panel>
            </div>
          </section>

          <section className="grid items-stretch gap-4 lg:grid-cols-2">
            <Panel
              title="Email domains"
              description="Lead emails with lower / elevated risk split"
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
            title="Partner quality"
            description="Confirmed call outcomes by partner — denominators and unresolved included. Context only; partner history does not independently mark a lead suspicious."
            icon={ShieldAlert}
          >
            <PartnerScorecardsPanel />
          </Panel>

          <Panel
            title="UTM source trust"
            description="Per-source lead volume and ZIP/IP location mismatch (total, 7d, 30d). Cluster status uses the 30d mismatch rate (≥50%, n≥10)."
            icon={AtSign}
          >
            <UtmSourceTrustPanel />
          </Panel>

          <section className="space-y-3">
            <h2 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Detection health
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Events with SDK version (7d)"
                value={formatCount(
                  summary.detectionHealth?.eventsWithSdkVersion ?? 0
                )}
                hint={`${formatCount(summary.detectionHealth?.eventsMissingSdkVersion ?? 0)} missing version (reduced coverage)`}
              />
              <StatCard
                label="Missing capabilities"
                value={formatCount(
                  summary.detectionHealth?.eventsMissingCapabilities ?? 0
                )}
                hint="Old or reduced clients omit capability flags"
              />
              <StatCard
                label="Integrity findings (7d)"
                value={formatCount(
                  summary.detectionHealth?.integrityFindingEvents ?? 0
                )}
                hint="Shadow findings only — never gates lead delivery"
              />
              <StatCard
                label="Network lists"
                value={
                  summary.detectionHealth?.network.expired
                    ? "Stale"
                    : summary.detectionHealth?.network.parseStatus || "—"
                }
                hint={`Proxy: ${summary.detectionHealth?.network.proxyListStatus ?? "—"} · ASN: ${summary.detectionHealth?.network.asnDbStatus ?? "—"} · as of ${summary.detectionHealth?.network.publicationDate || "unknown"}`}
              />
            </div>
            {(summary.detectionHealth?.sdkVersions?.length ?? 0) > 0 ? (
              <Panel
                title="SDK adoption"
                description="Event volume by sdk_version (7 days). Missing version means reduced detection coverage, not suspicion."
                icon={Activity}
              >
                <ScrollBody>
                  <CountTable
                    rows={summary.detectionHealth?.sdkVersions ?? []}
                    nameHeader="SDK version"
                    empty="No SDK version data yet."
                  />
                </ScrollBody>
              </Panel>
            ) : null}
            {(summary.detectionHealth?.coverageLimits?.length ?? 0) > 0 ? (
              <div className="rounded-xl border border-border px-5 py-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">
                  Explicit coverage limits
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {(summary.detectionHealth?.coverageLimits ?? []).map(
                    (limit) => (
                      <li key={limit}>{limit}</li>
                    )
                  )}
                </ul>
              </div>
            ) : null}
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
