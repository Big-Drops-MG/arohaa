import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { EventTrackingSubmissionRow } from "@/features/event-tracking/model/event-tracking"
import {
  eventTrackingSubmissionColumnLabels,
  eventTrackingSubmissionOverTimeTitle,
} from "@/features/event-tracking/utils/event-tracking-segment-labels"
import type { OverviewLandingFormType } from "@/features/overview/model/overview"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"

type EventTrackingSubmissionOverTimeCardProps = {
  formType: OverviewLandingFormType
  rows: EventTrackingSubmissionRow[]
  emptyMessage?: string
}

export function EventTrackingSubmissionOverTimeCard({
  formType,
  rows,
  emptyMessage = "No submission data for this period.",
}: EventTrackingSubmissionOverTimeCardProps) {
  const columns = eventTrackingSubmissionColumnLabels(formType)

  return (
    <Card
      className={cn(
        overviewCardPointerFocusResetClassName,
        overviewAnalyticCardShellClassName,
        "max-w-none pb-2"
      )}
    >
      <CardHeader className={overviewAnalyticCardHeaderClassName}>
        <CardTitle className={overviewSectionHeadingClassName}>
          {eventTrackingSubmissionOverTimeTitle(formType)}
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0 pb-2">
        <table className="w-full min-w-[280px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th
                scope="col"
                className="px-5 py-2.5 text-left text-xs font-semibold text-muted-foreground sm:px-6"
              >
                Date
              </th>
              <th
                scope="col"
                className="px-5 py-2.5 text-right text-xs font-semibold text-muted-foreground sm:px-6"
              >
                {columns.formSubmitted}
              </th>
              <th
                scope="col"
                className="px-5 py-2.5 text-right text-xs font-semibold text-muted-foreground sm:px-6"
              >
                {columns.share}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-5 py-8 text-center text-sm text-muted-foreground sm:px-6"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.date}
                  className="border-b border-border last:border-b-0"
                >
                  <td className="px-5 py-3 text-left font-medium text-foreground sm:px-6">
                    {row.date}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-foreground tabular-nums sm:px-6">
                    {row.formSubmitted}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-foreground tabular-nums sm:px-6">
                    {row.share ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
