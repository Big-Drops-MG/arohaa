import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { FunnelDropOffRow } from "@/features/funnel/model/funnel"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"

type FunnelDropOffCardProps = {
  rows: FunnelDropOffRow[]
}

export function FunnelDropOffCard({ rows }: FunnelDropOffCardProps) {
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
          Form drop-off by field
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-[1fr_auto_auto] border-b border-border px-5 py-2.5 sm:px-6">
          <span className="text-sm font-medium text-muted-foreground">
            Field Name
          </span>
          <span className="min-w-[5.5rem] text-right text-sm font-medium text-muted-foreground">
            Drop-offs
          </span>
          <span className="min-w-[4.5rem] pl-6 text-right text-sm font-medium text-muted-foreground">
            % Drop
          </span>
        </div>
        {rows.map((row, index) => (
          <div
            key={row.fieldName}
            className={cn(
              "grid grid-cols-[1fr_auto_auto] items-center px-5 py-3 sm:px-6",
              index < rows.length - 1 && "border-b border-border/60"
            )}
          >
            <span
              className={cn(
                "text-sm text-foreground",
                row.emphasized ? "font-semibold" : "font-normal"
              )}
            >
              {row.fieldName}
            </span>
            <span className="min-w-[5.5rem] text-right text-sm text-foreground tabular-nums">
              {row.dropOffs}
            </span>
            <span className="min-w-[4.5rem] pl-6 text-right text-sm text-foreground tabular-nums">
              {row.percentDrop}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
