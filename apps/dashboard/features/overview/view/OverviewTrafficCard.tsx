import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  overviewAnalyticCardContentPaddingClassName,
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"
import type { OverviewTrafficStat } from "@/features/overview/model/overview"

type OverviewTrafficCardProps = {
  stats: OverviewTrafficStat[]
}

export function OverviewTrafficCard({ stats }: OverviewTrafficCardProps) {
  return (
    <Card
      className={cn(
        overviewCardPointerFocusResetClassName,
        overviewAnalyticCardShellClassName
      )}
    >
      <CardHeader className={overviewAnalyticCardHeaderClassName}>
        <CardTitle className={overviewSectionHeadingClassName}>
          Traffic
        </CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          "grid gap-3 sm:grid-cols-2",
          overviewAnalyticCardContentPaddingClassName
        )}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl bg-muted/50 px-4 py-4 ring-1 ring-border/60"
          >
            <p className="text-xs font-medium text-muted-foreground">
              {s.label}
            </p>
            <p className="mt-2 font-heading text-xl font-semibold text-foreground tabular-nums">
              {s.value}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
