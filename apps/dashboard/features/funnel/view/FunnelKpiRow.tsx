import { cn } from "@workspace/ui/lib/utils"
import type {
  FunnelKpiMetricId,
  FunnelMetricKpi,
} from "@/features/funnel/model/funnel"
import { FunnelTrendBadge } from "@/features/funnel/view/FunnelTrendBadge"

type FunnelKpiRowProps = {
  metrics: FunnelMetricKpi[]
  activeKpiId: FunnelKpiMetricId
  onKpiSelect: (id: FunnelKpiMetricId) => void
}

export function FunnelKpiRow({
  metrics,
  activeKpiId,
  onKpiSelect,
}: FunnelKpiRowProps) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {metrics.map((metric) => {
        const active = metric.id === activeKpiId
        return (
          <button
            key={metric.id}
            type="button"
            onClick={() => onKpiSelect(metric.id)}
            aria-pressed={active}
            className={cn(
              "rounded-[15px] border px-4 py-4 text-left shadow-xs transition-colors outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              active
                ? "border-black bg-black text-white"
                : "border-foreground/10 bg-card text-foreground hover:border-neutral-300 hover:bg-neutral-50/80"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p
                className={cn(
                  "text-xs font-medium",
                  active ? "text-white/80" : "text-muted-foreground"
                )}
              >
                {metric.label}
              </p>
              {metric.change ? (
                <FunnelTrendBadge
                  change={metric.change}
                  variant={metric.changeVariant}
                />
              ) : null}
            </div>
            <p
              className={cn(
                "mt-2 font-heading text-xl font-semibold tracking-tight tabular-nums",
                active ? "text-white" : "text-foreground"
              )}
            >
              {metric.value}
            </p>
          </button>
        )
      })}
    </div>
  )
}
