"use client"

import { useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { overviewSectionHeadingClassName } from "@/features/overview/view/overview-card-density"
import {
  trafficSourcesTabBarClassName,
  trafficSourcesTitleClassName,
  trafficTableCardShellClassName,
} from "@/features/traffic/view/traffic-card-styles"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"
import type { TrafficReferrerRow } from "@/features/traffic/model/traffic"

type TrafficSourcesCardProps = {
  referrers: TrafficReferrerRow[]
  utmParameters: TrafficReferrerRow[]
}

type SourcesTab = "referrers" | "utm"

const tabButtonClassName = "pb-3 text-sm transition-colors outline-none"

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

export function TrafficSourcesCard({
  referrers,
  utmParameters,
}: TrafficSourcesCardProps) {
  const [activeTab, setActiveTab] = useState<SourcesTab>("referrers")
  const rows = activeTab === "referrers" ? referrers : utmParameters

  return (
    <Card
      className={cn(
        overviewCardPointerFocusResetClassName,
        trafficTableCardShellClassName
      )}
    >
      <CardHeader className={trafficSourcesTitleClassName}>
        <CardTitle className={overviewSectionHeadingClassName}>
          Traffic sources
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col p-0">
        <div className={trafficSourcesTabBarClassName}>
          <div className="flex gap-6 border-b border-border">
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
        {rows.length === 0 ? (
          <p className="px-5 py-3 text-sm text-muted-foreground sm:px-6">
            No data for this period.
          </p>
        ) : (
          rows.map((row, index) => (
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
          ))
        )}
      </CardContent>
    </Card>
  )
}
