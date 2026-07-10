"use client"

import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { UtmDashboardData } from "@/features/utm/model/utm"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"

type UtmOverviewCardsProps = {
  data: UtmDashboardData
}

function MetricCard({
  title,
  value,
  description,
}: {
  title: string
  value: number
  description?: string
}) {
  return (
    <Card className={cn(overviewAnalyticCardShellClassName, "min-w-0")}>
      <CardHeader className={overviewAnalyticCardHeaderClassName}>
        <CardTitle className="text-sm font-medium text-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 px-5 pb-5 sm:px-6">
        <p className="font-heading text-3xl font-semibold tabular-nums">
          {value}
        </p>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function UtmOverviewCards({ data }: UtmOverviewCardsProps) {
  const { stats } = data

  return (
    <div className="space-y-5">
      <div>
        <h2 className={overviewSectionHeadingClassName}>UTM Overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Source and S1 parameters tracked for this landing page.
        </p>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <MetricCard
          title="Total UTM Params"
          value={stats.total}
          description="Source + S1 combined"
        />
        <MetricCard title="Active Source" value={stats.activeSource} />
        <MetricCard title="Active S1" value={stats.activeS1} />
        <MetricCard title="Blocked Source" value={stats.blockedSource} />
        <MetricCard title="Blocked S1" value={stats.blockedS1} />
      </div>
    </div>
  )
}
