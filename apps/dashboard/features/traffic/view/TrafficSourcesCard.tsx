"use client"

import { useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"
import type {
  TrafficReferrerRow,
  TrafficUtmParamKey,
  TrafficUtmParamTab,
} from "@/features/traffic/model/traffic"
import { TrafficExpandableCard } from "@/features/traffic/view/TrafficExpandableCard"
import {
  trafficBreakdownCardContentClassName,
  trafficBreakdownCardShellClassName,
} from "@/features/traffic/view/traffic-card-layout"

type TrafficSourcesCardProps = {
  referrers: TrafficReferrerRow[]
  utmByParam: TrafficUtmParamTab[]
  expandable?: boolean
  previewRowLimit?: number
}

type SourcesTab = "referrers" | "utm"

type SourceListRow = {
  label: string
  visitors: string
}

const tabButtonClassName = "pb-3 text-sm transition-colors outline-none"

const trafficSourcesTabBarClassName =
  "flex shrink-0 items-end justify-between gap-4 border-b border-border px-5 !pt-3 !pb-0 sm:px-6"

const utmParamTabBarClassName =
  "flex shrink-0 gap-4 overflow-x-auto border-b border-border/60 px-5 pt-2.5 pb-0 sm:px-6"

function SourcesTabButton({
  active,
  label,
  onClick,
  className,
}: {
  active: boolean
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        tabButtonClassName,
        "-mb-px border-b-2",
        active
          ? "border-neutral-950 font-semibold text-neutral-950"
          : "border-transparent font-normal text-neutral-600 hover:text-neutral-900",
        className
      )}
    >
      {label}
    </button>
  )
}

function UtmParamTabButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mb-px shrink-0 border-b-2 pb-2 text-xs transition-colors outline-none",
        active
          ? "border-neutral-950 font-semibold text-neutral-950"
          : "border-transparent font-normal text-neutral-500 hover:text-neutral-800"
      )}
    >
      {label}
    </button>
  )
}

function limitRows(rows: SourceListRow[], limit?: number): SourceListRow[] {
  if (limit == null) return rows
  return rows.slice(0, limit)
}

function TrafficSourcesList({
  rows,
  emptyMessage,
}: {
  rows: SourceListRow[]
  emptyMessage: string
}) {
  if (rows.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-muted-foreground sm:px-6">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {rows.map((row, index) => (
        <div
          key={`${row.label}-${index}`}
          className={cn(
            "flex items-center justify-between gap-3 px-5 py-3 sm:px-6",
            index < rows.length - 1 && "border-b border-border/60"
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="size-5 shrink-0 rounded-sm bg-neutral-200"
              aria-hidden
            />
            <span className="truncate text-sm font-medium text-foreground">
              {row.label}
            </span>
          </div>
          <span className="shrink-0 text-sm font-medium text-foreground tabular-nums">
            {row.visitors}
          </span>
        </div>
      ))}
    </div>
  )
}

function TrafficSourcesCardContent({
  referrers,
  utmByParam,
  previewRowLimit,
  emptyMessage = "No data for this period.",
}: TrafficSourcesCardProps & { emptyMessage?: string }) {
  const [activeTab, setActiveTab] = useState<SourcesTab>("referrers")
  const [activeUtmKey, setActiveUtmKey] = useState<TrafficUtmParamKey | null>(
    null
  )

  const resolvedUtmKey =
    activeUtmKey && utmByParam.some((tab) => tab.key === activeUtmKey)
      ? activeUtmKey
      : (utmByParam[0]?.key ?? null)

  const activeUtmTab =
    utmByParam.find((tab) => tab.key === resolvedUtmKey) ?? utmByParam[0]

  const rows =
    activeTab === "referrers"
      ? limitRows(
          referrers.map((row) => ({
            label: row.domain,
            visitors: row.visitors,
          })),
          previewRowLimit
        )
      : limitRows(
          (activeUtmTab?.rows ?? []).map((row) => ({
            label: row.value,
            visitors: row.visitors,
          })),
          previewRowLimit
        )

  const utmEmptyMessage =
    utmByParam.length === 0
      ? "No UTM parameters for this period."
      : emptyMessage

  return (
    <>
      <div className={trafficSourcesTabBarClassName}>
        <div className="flex gap-6">
          <SourcesTabButton
            active={activeTab === "referrers"}
            label="Referrers"
            onClick={() => setActiveTab("referrers")}
          />
          <SourcesTabButton
            active={activeTab === "utm"}
            label="UTM Parameters"
            onClick={() => setActiveTab("utm")}
          />
        </div>
        <span
          className={cn(
            tabButtonClassName,
            "shrink-0 font-medium text-muted-foreground"
          )}
        >
          Visitors
        </span>
      </div>
      {activeTab === "utm" && utmByParam.length > 0 ? (
        <div className={utmParamTabBarClassName}>
          {utmByParam.map((tab) => (
            <UtmParamTabButton
              key={tab.key}
              active={tab.key === resolvedUtmKey}
              label={tab.label}
              onClick={() => setActiveUtmKey(tab.key)}
            />
          ))}
        </div>
      ) : null}
      <TrafficSourcesList
        rows={rows}
        emptyMessage={activeTab === "utm" ? utmEmptyMessage : emptyMessage}
      />
    </>
  )
}

function TrafficSourcesCardBody({
  referrers,
  utmByParam,
  previewRowLimit,
  emptyMessage = "No data for this period.",
}: TrafficSourcesCardProps & { emptyMessage?: string }) {
  return (
    <Card
      className={cn(
        overviewCardPointerFocusResetClassName,
        overviewAnalyticCardShellClassName,
        trafficBreakdownCardShellClassName
      )}
    >
      <CardHeader className={overviewAnalyticCardHeaderClassName}>
        <CardTitle className={overviewSectionHeadingClassName}>
          Traffic sources
        </CardTitle>
      </CardHeader>
      <CardContent className={trafficBreakdownCardContentClassName}>
        <TrafficSourcesCardContent
          referrers={referrers}
          utmByParam={utmByParam}
          previewRowLimit={previewRowLimit}
          emptyMessage={emptyMessage}
        />
      </CardContent>
    </Card>
  )
}

export function TrafficSourcesCard({
  referrers,
  utmByParam,
  expandable = false,
  previewRowLimit,
}: TrafficSourcesCardProps) {
  const body = (
    <TrafficSourcesCardBody
      referrers={referrers}
      utmByParam={utmByParam}
      previewRowLimit={previewRowLimit}
    />
  )

  if (!expandable) {
    return body
  }

  return (
    <TrafficExpandableCard
      title="Traffic sources"
      className="h-full min-h-0"
      expandedContent={
        <TrafficSourcesCardContent
          referrers={referrers}
          utmByParam={utmByParam}
        />
      }
    >
      {body}
    </TrafficExpandableCard>
  )
}
