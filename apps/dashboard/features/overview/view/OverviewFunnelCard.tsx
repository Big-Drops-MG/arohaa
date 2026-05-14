import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"
import type {
  OverviewFunnelChangeVariant,
  OverviewFunnelStep,
} from "@/features/overview/model/overview"

function changeBadgeClass(variant: OverviewFunnelChangeVariant | undefined) {
  if (variant === "positive") {
    return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/15"
  }
  if (variant === "negative") {
    return "bg-red-50 text-red-800 ring-1 ring-red-600/15"
  }
  return "bg-muted text-muted-foreground ring-1 ring-border"
}

type OverviewFunnelCardProps = {
  steps: OverviewFunnelStep[]
}

export function OverviewFunnelCard({ steps }: OverviewFunnelCardProps) {
  return (
    <Card
      className={cn(
        "flex h-full min-h-0 flex-col",
        overviewCardPointerFocusResetClassName,
        overviewAnalyticCardShellClassName
      )}
    >
      <CardHeader className={overviewAnalyticCardHeaderClassName}>
        <CardTitle className={overviewSectionHeadingClassName}>
          Funnel
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {steps.map((step, index) => (
          <div
            key={step.label}
            className={cn(
              "flex min-h-0 flex-1 items-center justify-between gap-3 px-5 py-3 sm:px-6 sm:py-4",
              index < steps.length - 1 && "border-b border-border"
            )}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {step.label}
              </p>
              <p className="mt-0.5 font-heading text-lg font-semibold text-foreground tabular-nums">
                {step.value}
              </p>
            </div>
            {step.change ? (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
                  changeBadgeClass(step.changeVariant)
                )}
              >
                {step.change}
              </span>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
