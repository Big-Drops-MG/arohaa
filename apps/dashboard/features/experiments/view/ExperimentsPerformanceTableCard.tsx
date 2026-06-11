import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { ExperimentsTableSection } from "@/features/experiments/model/experiments"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"

type ExperimentsPerformanceTableCardProps = {
  section: ExperimentsTableSection
}

export function ExperimentsPerformanceTableCard({
  section,
}: ExperimentsPerformanceTableCardProps) {
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
          {section.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div
          className="grid border-b border-border px-5 py-2.5 sm:px-6"
          style={{
            gridTemplateColumns: `repeat(${section.columns.length}, minmax(0, 1fr))`,
          }}
        >
          {section.columns.map((col) => (
            <span
              key={col.key}
              className="text-sm font-medium text-muted-foreground"
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
              rowIndex < section.rows.length - 1 && "border-b border-border/60"
            )}
            style={{
              gridTemplateColumns: `repeat(${section.columns.length}, minmax(0, 1fr))`,
            }}
          >
            {section.columns.map((col) => (
              <span
                key={col.key}
                className="text-sm text-foreground tabular-nums"
              >
                {row[col.key]}
              </span>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
