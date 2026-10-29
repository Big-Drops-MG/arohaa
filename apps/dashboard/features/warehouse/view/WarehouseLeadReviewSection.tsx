"use client"

import { useMemo, useState, type ReactNode } from "react"
import { ShieldAlert, Users } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import type { WarehouseShortcutLead } from "@/lib/server/warehouse-load"
import { ShortcutLeadsTable } from "@/features/warehouse/view/ShortcutLeadsTable"
import { CalibrationPanel } from "@/features/warehouse/view/CalibrationPanel"

export type LeadReviewFilter =
  | "all"
  | "elevated"
  | "incomplete"
  | "related"
  | "pending"

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString("en-US")
}

function FilterStat({
  label,
  value,
  hint,
  tone = "default",
  active,
  onClick,
}: {
  label: string
  value: string
  hint?: string
  tone?: "default" | "fraud"
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-full flex-col rounded-xl border px-4 py-3.5 text-left transition-colors",
        active
          ? "border-foreground bg-muted/60 ring-1 ring-foreground/20"
          : "border-border bg-background hover:bg-muted/40",
        tone === "fraud" && !active && "border-rose-200 bg-rose-50/50"
      )}
    >
      <p
        className={cn(
          "text-[11px] font-medium tracking-wide uppercase",
          tone === "fraud" ? "text-rose-800" : "text-muted-foreground"
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tracking-tight tabular-nums",
          tone === "fraud" ? "text-rose-950" : "text-foreground"
        )}
      >
        {value}
      </p>
      {hint ? (
        <p
          className={cn(
            "mt-auto pt-1.5 text-xs leading-relaxed",
            tone === "fraud" ? "text-rose-800/75" : "text-muted-foreground"
          )}
        >
          {hint}
        </p>
      ) : null}
    </button>
  )
}

function Panel({
  title,
  description,
  children,
  bodyClassName,
}: {
  title: string
  description?: string
  children: ReactNode
  bodyClassName?: string
}) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-background">
      <header className="shrink-0 border-b border-border px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
            <Users className="size-4" aria-hidden />
          </div>
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

function matchesFilter(
  lead: WarehouseShortcutLead,
  filter: LeadReviewFilter
): boolean {
  if (filter === "all") return true
  const fraud = lead.fraud
  if (filter === "elevated") {
    return Boolean(
      fraud?.scoreAvailable &&
      (fraud.effectiveLabel === "fraud" || fraud.label === "fraud")
    )
  }
  if (filter === "incomplete") {
    return fraud?.coverage === "insufficient" || fraud == null
  }
  if (filter === "related") {
    return lead.relatedCount > 0
  }
  if (filter === "pending") {
    return true
  }
  return true
}

export function WarehouseLeadReviewSection({
  pendingReviews,
  shortcutLeads,
}: {
  submissions?: number
  elevatedRisk?: number
  incompleteAssessments?: number
  relatedContactGroups?: number
  pendingReviews: number
  shortcutLeads: WarehouseShortcutLead[]
}) {
  const [filter, setFilter] = useState<LeadReviewFilter>("all")

  const loadedStats = useMemo(() => {
    let elevated = 0
    let incomplete = 0
    let related = 0
    for (const lead of shortcutLeads) {
      if (matchesFilter(lead, "elevated")) elevated += 1
      if (matchesFilter(lead, "incomplete")) incomplete += 1
      if (matchesFilter(lead, "related")) related += 1
    }
    return {
      submissions: shortcutLeads.length,
      elevated,
      incomplete,
      related,
    }
  }, [shortcutLeads])

  const filtered = useMemo(() => {
    if (filter === "pending") {
      return shortcutLeads
    }
    return shortcutLeads.filter((lead) => matchesFilter(lead, filter))
  }, [filter, shortcutLeads])

  const filterHint =
    filter === "all"
      ? null
      : filter === "pending"
        ? `Pending reviews are org-wide (${formatCount(pendingReviews)}); showing all ${formatCount(shortcutLeads.length)} loaded review rows`
        : `Showing ${filtered.length} of ${shortcutLeads.length} loaded review rows`

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Lead quality overview
          </h2>
          {filter !== "all" ? (
            <button
              type="button"
              className="text-xs font-medium text-sky-700 underline-offset-2 hover:underline"
              onClick={() => setFilter("all")}
            >
              Clear filter
            </button>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <FilterStat
            label="Submissions"
            value={formatCount(loadedStats.submissions)}
            hint="Click to show all loaded leads"
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <FilterStat
            label="Elevated risk"
            value={formatCount(loadedStats.elevated)}
            hint="Trust below threshold — informational"
            tone="fraud"
            active={filter === "elevated"}
            onClick={() => setFilter("elevated")}
          />
          <FilterStat
            label="Incomplete data"
            value={formatCount(loadedStats.incomplete)}
            hint="Insufficient signal coverage"
            active={filter === "incomplete"}
            onClick={() => setFilter("incomplete")}
          />
          <FilterStat
            label="Related groups"
            value={formatCount(loadedStats.related)}
            hint="Loaded leads with related contact matches"
            active={filter === "related"}
            onClick={() => setFilter("related")}
          />
          <FilterStat
            label="Pending reviews"
            value={formatCount(pendingReviews)}
            hint="Org-wide backlog — open Related to review"
            active={filter === "pending"}
            onClick={() => setFilter("pending")}
          />
        </div>
        {filterHint ? (
          <p className="text-xs text-muted-foreground">{filterHint}</p>
        ) : null}
      </section>

      <Panel
        title="Lead review"
        description={
          filtered.length > 0
            ? `${formatCount(filtered.length)} sessions — assessments are informational only`
            : "Copy/Paste sessions with trust, coverage, related submissions and review"
        }
        bodyClassName="min-w-0 px-0 py-0"
      >
        <div className="max-h-[28rem] min-w-0 overflow-x-auto overflow-y-auto overscroll-contain px-5 py-4">
          <ShortcutLeadsTable
            rows={filtered}
            emptyMessage={
              shortcutLeads.length === 0
                ? undefined
                : filter === "all"
                  ? "No review rows matched."
                  : `No loaded review rows match the ${filter} filter. Clear the filter to see all ${formatCount(shortcutLeads.length)} loaded leads.`
            }
          />
        </div>
      </Panel>

      <section className="rounded-xl border border-border bg-background">
        <header className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
            <ShieldAlert className="size-4" aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Calibration
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Findings vs later administrator decisions — do not change weights
              from a single partner sample
            </p>
          </div>
        </header>
        <div className="px-5 py-4">
          <CalibrationPanel />
        </div>
      </section>
    </div>
  )
}
