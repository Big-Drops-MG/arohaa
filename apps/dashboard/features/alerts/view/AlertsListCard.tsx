import { AlertTriangle, CircleAlert } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { Card, CardContent } from "@workspace/ui/components/card"
import type {
  AlertsListItem,
  AlertsListItemSeverity,
} from "@/features/alerts/model/alerts"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"

type AlertsListCardProps = {
  items: AlertsListItem[]
}

function AlertRowIcon({ severity }: { severity: AlertsListItemSeverity }) {
  if (severity === "info") {
    return (
      <CircleAlert
        className="size-5 shrink-0 text-muted-foreground"
        strokeWidth={1.5}
        aria-hidden
      />
    )
  }

  return (
    <AlertTriangle
      className="size-5 shrink-0 text-amber-600"
      strokeWidth={1.5}
      aria-hidden
    />
  )
}

export function AlertsListCard({ items }: AlertsListCardProps) {
  return (
    <Card
      className={cn(
        overviewCardPointerFocusResetClassName,
        "max-w-none gap-0 rounded-[15px] border border-foreground/10 bg-card py-0 shadow-xs"
      )}
    >
      <CardContent className="p-0">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={cn(
              "flex items-center justify-between gap-4 px-5 py-4 sm:px-6",
              index < items.length - 1 && "border-b border-border/60"
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <AlertRowIcon severity={item.severity} />
              <span className="text-sm font-medium text-foreground">
                {item.message}
              </span>
            </div>
            <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
              {item.date}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
