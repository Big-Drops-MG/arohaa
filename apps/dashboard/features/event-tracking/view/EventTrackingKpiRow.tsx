import type { EventTrackingKpi } from "@/features/event-tracking/model/event-tracking"

type EventTrackingKpiRowProps = {
  kpis: EventTrackingKpi[]
}

export function EventTrackingKpiRow({ kpis }: EventTrackingKpiRowProps) {
  return (
    <div className="grid grid-cols-5 gap-4">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="rounded-[15px] border border-foreground/10 bg-card px-4 py-4 shadow-xs"
        >
          <p className="text-xs font-medium text-muted-foreground">
            {kpi.label}
          </p>
          <p className="mt-2 font-heading text-xl font-semibold tracking-tight text-foreground tabular-nums">
            {kpi.value}
          </p>
        </div>
      ))}
    </div>
  )
}
