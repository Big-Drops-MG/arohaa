import type { FunnelMetricKpi } from "@/features/funnel/model/funnel"
import { FunnelTrendBadge } from "@/features/funnel/view/FunnelTrendBadge"

type FunnelKpiRowProps = {
  metrics: FunnelMetricKpi[]
}

export function FunnelKpiRow({ metrics }: FunnelKpiRowProps) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-[15px] border border-foreground/10 bg-card px-4 py-4 shadow-xs"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              {metric.label}
            </p>
            {metric.change ? (
              <FunnelTrendBadge
                change={metric.change}
                variant={metric.changeVariant}
              />
            ) : null}
          </div>
          <p className="mt-2 font-heading text-xl font-semibold tracking-tight text-foreground tabular-nums">
            {metric.value}
          </p>
        </div>
      ))}
    </div>
  )
}
