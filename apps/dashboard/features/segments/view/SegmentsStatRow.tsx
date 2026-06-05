"use client"

import type { SegmentKpi } from "@/features/segments/model/segments"

const statCardShellClassName =
  "rounded-[15px] border border-foreground/10 bg-card px-4 py-4 text-left shadow-xs"

const statLabelClassName = "text-xs font-medium text-muted-foreground"
const statValueClassName =
  "mt-2 font-heading text-xl font-semibold tracking-tight tabular-nums text-foreground"

type SegmentsStatCardProps = {
  label: string
  value: string
}

function SegmentsStatCard({ label, value }: SegmentsStatCardProps) {
  return (
    <div className={statCardShellClassName}>
      <p className={statLabelClassName}>{label}</p>
      <p className={statValueClassName}>{value}</p>
    </div>
  )
}

type SegmentsStatRowProps = {
  kpis: SegmentKpi[]
}

export function SegmentsStatRow({ kpis }: SegmentsStatRowProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {kpis.map((kpi) => (
        <SegmentsStatCard key={kpi.id} label={kpi.label} value={kpi.value} />
      ))}
    </div>
  )
}
