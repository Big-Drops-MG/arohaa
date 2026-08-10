"use client"

import type { InsightsSectionPayload } from "@/features/insights/model/insights"
import { InsightsChartCard } from "@/features/insights/view/InsightsChartCard"
import { InsightsChartRenderer } from "@/features/insights/view/charts/InsightsChartRenderer"
import { InsightsKpiStrip } from "@/features/insights/view/InsightsKpiStrip"

type InsightsSectionPanelProps = {
  data: InsightsSectionPayload | null
  isLoading: boolean
  animateKey: string
}

export function InsightsSectionPanel({
  data,
  isLoading,
  animateKey,
}: InsightsSectionPanelProps) {
  const kpis = data?.kpis ?? []
  const charts = data?.charts ?? []

  return (
    <div className="flex flex-col gap-5">
      <InsightsKpiStrip kpis={kpis} isLoading={isLoading} />

      {isLoading && charts.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[340px] animate-pulse rounded-xl border border-neutral-200 bg-neutral-100/70"
            />
          ))}
        </div>
      ) : charts.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50 text-sm text-muted-foreground">
          Not enough events in this range
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {charts.map((chart, index) => (
            <InsightsChartCard
              key={chart.id}
              title={chart.title}
              helper={chart.helper}
              fullWidth={chart.fullWidth}
              index={index}
            >
              <InsightsChartRenderer
                chart={chart}
                animateKey={`${animateKey}:${chart.id}`}
              />
            </InsightsChartCard>
          ))}
        </div>
      )}
    </div>
  )
}
