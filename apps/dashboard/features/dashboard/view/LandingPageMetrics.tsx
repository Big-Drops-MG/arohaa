import type { LandingPageMetric } from "@/features/dashboard/model/landing-page"

type LandingPageMetricsProps = {
  metrics: LandingPageMetric[]
}

export function LandingPageMetrics({ metrics }: LandingPageMetricsProps) {
  return (
    <div className="grid grid-cols-3 gap-2 pt-2">
      {metrics.map((metric) => (
        <div key={metric.label} className="text-center">
          <p className="text-lg leading-none font-semibold text-foreground">
            {metric.value}
          </p>
          <p className="mt-1 text-[11px] leading-none text-muted-foreground">
            {metric.label}
          </p>
        </div>
      ))}
    </div>
  )
}
