import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { EventTrackingSubmissionRow } from "@/features/event-tracking/model/event-tracking"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"

type EventTrackingSubmissionTableCardProps = {
  rows: EventTrackingSubmissionRow[]
}

export function EventTrackingSubmissionTableCard({
  rows,
}: EventTrackingSubmissionTableCardProps) {
  return (
    <Card
      className={cn(
        overviewCardPointerFocusResetClassName,
        overviewAnalyticCardShellClassName,
        "max-w-none gap-0 py-0"
      )}
    >
      <CardHeader className={overviewAnalyticCardHeaderClassName}>
        <CardTitle className={overviewSectionHeadingClassName}>
          Form submission over time
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-3 border-b border-border px-5 py-2.5 sm:px-6">
          <span className="text-sm font-medium text-muted-foreground">
            Date
          </span>
          <span className="text-center text-sm font-medium text-muted-foreground">
            Form Submitted
          </span>
          <span className="text-right text-sm font-medium text-muted-foreground">
            FSR
          </span>
        </div>
        {rows.map((row, index) => (
          <div
            key={row.date}
            className={cn(
              "grid grid-cols-3 px-5 py-3 sm:px-6",
              index < rows.length - 1 && "border-b border-border/60"
            )}
          >
            <span className="text-sm text-foreground">{row.date}</span>
            <span className="text-center text-sm text-foreground tabular-nums">
              {row.formSubmitted}
            </span>
            <span className="text-right text-sm text-foreground tabular-nums">
              {row.fsr}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
