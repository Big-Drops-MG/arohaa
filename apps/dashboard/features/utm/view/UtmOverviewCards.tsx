"use client"

import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { UtmDashboardStats } from "@/features/utm/model/utm"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"

type UtmOverviewCardsProps = {
  stats: UtmDashboardStats
}

function StatCard({
  title,
  value,
  badge,
  description,
  tone,
}: {
  title: string
  value: number
  badge: string
  description: string
  tone: "brand" | "success" | "danger"
}) {
  const toneClass =
    tone === "success"
      ? "text-teal-700"
      : tone === "danger"
        ? "text-rose-700"
        : "text-foreground"

  return (
    <Card className={overviewAnalyticCardShellClassName}>
      <CardHeader className={overviewAnalyticCardHeaderClassName}>
        <CardTitle className={cn("text-sm font-medium", toneClass)}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 px-5 pb-5 sm:px-6">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-heading text-2xl font-semibold tabular-nums">
            {value}
          </p>
          <span className="text-xs font-semibold text-muted-foreground">
            {badge}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

export function UtmOverviewCards({ stats }: UtmOverviewCardsProps) {
  return (
    <div className="space-y-3">
      <h2 className={overviewSectionHeadingClassName}>UTM Overview</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total UTM Params"
          value={stats.total}
          badge="100%"
          description="All tracked UTM parameter entries."
          tone="brand"
        />
        <StatCard
          title="Active UTM Params"
          value={stats.active}
          badge={`${stats.activePct}%`}
          description="Currently allowed and processing traffic."
          tone="success"
        />
        <StatCard
          title="Blocked UTM Params"
          value={stats.blocked}
          badge={`${stats.blockedPct}%`}
          description="Disabled due to rules or policy checks."
          tone="danger"
        />
      </div>
    </div>
  )
}
