import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { overviewSectionHeadingClassName } from "@/features/overview/view/overview-card-density"
import {
  trafficTableCardHeaderClassName,
  trafficTableCardShellClassName,
} from "@/features/traffic/view/traffic-card-styles"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"
import type { TrafficTableSection } from "@/features/traffic/model/traffic"

type TrafficDataTableCardProps = {
  section: TrafficTableSection
}

export function TrafficDataTableCard({ section }: TrafficDataTableCardProps) {
  return (
    <Card
      className={cn(
        overviewCardPointerFocusResetClassName,
        trafficTableCardShellClassName
      )}
    >
      <CardHeader className={trafficTableCardHeaderClassName}>
        <CardTitle className={overviewSectionHeadingClassName}>
          {section.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-hidden rounded-b-[15px]">
          <div
            className="grid border-b border-border px-5 py-2.5 sm:px-6"
            style={{
              gridTemplateColumns: `repeat(${section.columns.length}, minmax(0, 1fr))`,
            }}
          >
            {section.columns.map((col) => (
              <span
                key={col.key}
                className={cn(
                  "text-sm font-medium text-muted-foreground",
                  col.align === "right" && "text-right"
                )}
              >
                {col.label}
              </span>
            ))}
          </div>
          {section.rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className={cn(
                "grid px-5 py-3 sm:px-6",
                rowIndex < section.rows.length - 1 &&
                  "border-b border-border/60"
              )}
              style={{
                gridTemplateColumns: `repeat(${section.columns.length}, minmax(0, 1fr))`,
              }}
            >
              {section.columns.map((col) => (
                <span
                  key={col.key}
                  className={cn(
                    "text-sm text-foreground tabular-nums",
                    col.align === "right" && "text-right"
                  )}
                >
                  {row[col.key]}
                </span>
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
