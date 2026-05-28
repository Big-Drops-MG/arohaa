import { cn } from "@workspace/ui/lib/utils"
import type {
  OverviewKpi,
  OverviewKpiMetricId,
} from "@/features/overview/model/overview"

type OverviewKpiRowProps = {
  kpis: OverviewKpi[]
  activeKpiId: OverviewKpiMetricId
  onKpiSelect: (id: OverviewKpiMetricId) => void
}

export function OverviewKpiRow({
  kpis,
  activeKpiId,
  onKpiSelect,
}: OverviewKpiRowProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi) => {
        const active = kpi.id === activeKpiId
        return (
          <button
            key={kpi.id}
            type="button"
            onClick={() => onKpiSelect(kpi.id)}
            aria-pressed={active}
            className={cn(
              "rounded-[15px] border px-4 py-4 text-left shadow-xs transition-colors outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              active
                ? "border-black bg-black text-white"
                : "border-foreground/10 bg-card text-foreground hover:border-neutral-300 hover:bg-neutral-50/80"
            )}
          >
            <p
              className={cn(
                "text-xs font-medium",
                active ? "text-white/80" : "text-muted-foreground"
              )}
            >
              {kpi.label}
            </p>
            <p
              className={cn(
                "mt-2 font-heading text-xl font-semibold tracking-tight tabular-nums",
                active ? "text-white" : "text-foreground"
              )}
            >
              {kpi.value}
            </p>
          </button>
        )
      })}
    </div>
  )
}
