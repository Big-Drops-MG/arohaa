"use client"

import type { EventTrackingKpi } from "@/features/event-tracking/model/event-tracking"

const statCardShellClassName =
  "rounded-[15px] border border-foreground/10 bg-card px-4 py-4 text-left shadow-xs"

const statLabelClassName = "text-xs font-medium text-muted-foreground"
const statValueClassName =
  "mt-2 font-heading text-xl font-semibold tracking-tight tabular-nums text-foreground"

type EventTrackingStatCardProps = {
  label: string
  value: string
}

function EventTrackingStatCard({ label, value }: EventTrackingStatCardProps) {
  return (
    <div className={statCardShellClassName}>
      <p className={statLabelClassName}>{label}</p>
      <p className={statValueClassName}>{value}</p>
    </div>
  )
}

type EventTrackingStatRowProps = {
  kpis: EventTrackingKpi[]
}

export function EventTrackingStatRow({ kpis }: EventTrackingStatRowProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <EventTrackingStatCard
          key={kpi.id}
          label={kpi.label}
          value={kpi.value}
        />
      ))}
    </div>
  )
}
