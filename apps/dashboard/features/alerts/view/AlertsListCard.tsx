import { cn } from "@workspace/ui/lib/utils"
import { Card, CardContent } from "@workspace/ui/components/card"
import { AlertSeverityIcon } from "@/features/alerts/view/AlertSeverityIcon"
import type { OverviewAlert } from "@/features/overview/model/overview"
import { overviewAnalyticCardShellClassName } from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"

type AlertsListCardProps = {
  alerts: OverviewAlert[]
  emptyMessage?: string
}

export function AlertsListCard({
  alerts,
  emptyMessage = "No alerts for this period.",
}: AlertsListCardProps) {
  return (
    <Card
      className={cn(
        overviewCardPointerFocusResetClassName,
        overviewAnalyticCardShellClassName,
        "max-w-none gap-0 pb-0"
      )}
    >
      <CardContent className="p-0">
        {alerts.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground sm:px-6">
            {emptyMessage}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="flex items-center gap-3 px-5 py-4 sm:px-6"
              >
                <AlertSeverityIcon severity={alert.severity} />
                <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                  {alert.message}
                </span>
                {alert.dateLabel ? (
                  <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                    {alert.dateLabel}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
