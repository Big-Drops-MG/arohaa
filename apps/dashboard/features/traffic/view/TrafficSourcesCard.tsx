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
import type { TrafficReferrerRow } from "@/features/traffic/model/traffic"
import { TrafficExpandableCard } from "@/features/traffic/view/TrafficExpandableCard"
import {
  trafficBreakdownCardContentClassName,
  trafficBreakdownCardShellClassName,
} from "@/features/traffic/view/traffic-card-layout"

type TrafficSourcesCardProps = {
  referrers: TrafficReferrerRow[]
  utmParameters: TrafficReferrerRow[]
  expandable?: boolean
  previewRowLimit?: number
}

type SourcesTab = "referrers" | "utm"

const tabButtonClassName = "pb-3 text-sm transition-colors outline-none"

const trafficSourcesTabBarClassName =
  "flex shrink-0 items-end justify-between gap-4 border-b border-border px-5 !pt-3 !pb-0 sm:px-6"

function SourcesTabButton({
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
        tabButtonClassName,
        "-mb-px border-b-2",
        active
          ? "border-neutral-950 font-semibold text-neutral-950"
          : "border-transparent font-normal text-neutral-600 hover:text-neutral-900"
      )}
    >
      {label}
    </button>
  )
}

function limitReferrerRows(
  rows: TrafficReferrerRow[],
  limit?: number
): TrafficReferrerRow[] {
  if (limit == null) return rows
  return rows.slice(0, limit)
}

function TrafficSourcesList({
  rows,
  emptyMessage,
}: {
  rows: TrafficReferrerRow[]
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
          key={`${row.domain}-${index}`}
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
              {row.domain}
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
  utmParameters,
  previewRowLimit,
  emptyMessage = "No data for this period.",
}: TrafficSourcesCardProps & { emptyMessage?: string }) {
  const [activeTab, setActiveTab] = useState<SourcesTab>("referrers")
  const rows =
    activeTab === "referrers"
      ? limitReferrerRows(referrers, previewRowLimit)
      : limitReferrerRows(utmParameters, previewRowLimit)

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
      <TrafficSourcesList rows={rows} emptyMessage={emptyMessage} />
    </>
  )
}

function TrafficSourcesCardBody({
  referrers,
  utmParameters,
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
          utmParameters={utmParameters}
          previewRowLimit={previewRowLimit}
          emptyMessage={emptyMessage}
        />
      </CardContent>
    </Card>
  )
}

export function TrafficSourcesCard({
  referrers,
  utmParameters,
  expandable = false,
  previewRowLimit,
}: TrafficSourcesCardProps) {
  const body = (
    <TrafficSourcesCardBody
      referrers={referrers}
      utmParameters={utmParameters}
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
          utmParameters={utmParameters}
        />
      }
    >
      {body}
    </TrafficExpandableCard>
  )
}
