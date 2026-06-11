import { ChevronRight } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { Card, CardContent } from "@workspace/ui/components/card"
import type { ExperimentListRow } from "@/features/experiments/model/experiments"
import { overviewAnalyticCardShellClassName } from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"

type ExperimentsListCardProps = {
  experiments: ExperimentListRow[]
}

export function ExperimentsListCard({ experiments }: ExperimentsListCardProps) {
  return (
    <Card
      className={cn(
        overviewCardPointerFocusResetClassName,
        overviewAnalyticCardShellClassName,
        "max-w-none gap-0 py-0"
      )}
    >
      <CardContent className="p-0 pt-4">
        <div className="grid grid-cols-[minmax(0,2fr)_auto_auto_auto_auto] border-b border-border px-5 py-2.5 sm:px-6">
          <span className="text-sm font-medium text-muted-foreground">
            Experiment Name
          </span>
          <span className="min-w-[5.5rem] text-sm font-medium text-muted-foreground">
            Status
          </span>
          <span className="min-w-[5.5rem] pl-4 text-sm font-medium text-muted-foreground">
            Variants
          </span>
          <span className="min-w-[4.5rem] pl-4 text-sm font-medium text-muted-foreground">
            Start Date
          </span>
          <span className="w-6" aria-hidden />
        </div>
        {experiments.map((experiment, index) => (
          <div
            key={experiment.id}
            className={cn(
              "grid grid-cols-[minmax(0,2fr)_auto_auto_auto_auto] items-center px-5 py-3 sm:px-6",
              experiment.highlighted && "bg-neutral-50",
              index < experiments.length - 1 && "border-b border-border/60"
            )}
          >
            <span className="text-sm font-medium text-foreground">
              {experiment.name}
            </span>
            <span className="min-w-[5.5rem] text-sm text-foreground">
              {experiment.status}
            </span>
            <span className="min-w-[5.5rem] pl-4 text-sm text-foreground tabular-nums">
              {experiment.variants}
            </span>
            <span className="min-w-[4.5rem] pl-4 text-sm text-foreground tabular-nums">
              {experiment.startDate}
            </span>
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
