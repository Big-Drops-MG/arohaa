import type { LandingPageMetric } from "@/features/dashboard/model/landing-page"

type LandingPageMetricsProps = {
  metrics: LandingPageMetric[]
}

export function LandingPageMetrics({ metrics }: LandingPageMetricsProps) {
  return (
    <div className="grid grid-cols-3">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="min-w-0 border-l border-border/50 px-1 text-center first:border-l-0"
        >
          <p className="text-[17px] leading-none font-semibold tracking-tight text-foreground tabular-nums">
            {metric.value}
          </p>
          <p className="mt-1.5 truncate text-[10px] leading-none font-medium tracking-wide text-muted-foreground uppercase">
            {metric.label}
          </p>
        </div>
      ))}
    </div>
  )
}
