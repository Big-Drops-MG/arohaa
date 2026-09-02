import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import {
  dashboardGridFunnelChartClassName,
  dashboardGridTwoColClassName,
  overviewAnalyticCardContentPaddingClassName,
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
} from "@/features/overview/view/overview-card-density"

type DashboardKpiRowSkeletonProps = {
  count?: number
  className?: string
}

export function DashboardKpiRowSkeleton({
  count = 6,
  className,
}: DashboardKpiRowSkeletonProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 md:grid-cols-3",
        count >= 6 ? "xl:grid-cols-6" : "xl:grid-cols-4",
        className
      )}
      aria-hidden
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-foreground/10 bg-card px-4 py-4 shadow-xs"
        >
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-3 h-7 w-20" />
        </div>
      ))}
    </div>
  )
}

type DashboardAnalyticCardSkeletonProps = {
  className?: string
  rows?: number
  withHeader?: boolean
}

export function DashboardAnalyticCardSkeleton({
  className,
  rows = 6,
  withHeader = true,
}: DashboardAnalyticCardSkeletonProps) {
  return (
    <div
      className={cn(
        "flex min-h-[220px] flex-col rounded-[15px] border border-foreground/10 bg-card",
        overviewAnalyticCardShellClassName,
        className
      )}
      aria-hidden
    >
      {withHeader ? (
        <div className={overviewAnalyticCardHeaderClassName}>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="ml-auto h-7 w-20" />
        </div>
      ) : null}
      <div
        className={cn(
          "flex flex-1 flex-col gap-3",
          overviewAnalyticCardContentPaddingClassName
        )}
      >
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-12 shrink-0" />
            <Skeleton className="h-3 w-10 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[15px] border border-foreground/10 bg-card",
        overviewAnalyticCardShellClassName,
        className
      )}
      aria-hidden
    >
      <div className={overviewAnalyticCardHeaderClassName}>
        <Skeleton className="h-4 w-40" />
      </div>
      <div
        className={cn("space-y-3", overviewAnalyticCardContentPaddingClassName)}
      >
        <div className="flex h-48 items-end gap-2 pt-2 sm:h-56">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton
              key={i}
              className="w-full rounded-t-sm"
              style={{ height: `${28 + ((i * 17) % 60)}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function DashboardHeatmapSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative min-h-[420px] overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50",
        className
      )}
      aria-hidden
    >
      <div className="absolute inset-0 flex flex-col gap-4 p-6">
        <Skeleton className="h-8 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-1/2 max-w-sm" />
        <Skeleton className="mt-4 h-40 w-full max-w-lg" />
        <Skeleton className="h-10 w-36" />
        <div className="mt-auto grid grid-cols-3 gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
    </div>
  )
}

export function DashboardAlertsListSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[15px] border border-foreground/10 bg-card",
        overviewAnalyticCardShellClassName,
        className
      )}
      aria-hidden
    >
      <div className={overviewAnalyticCardHeaderClassName}>
        <Skeleton className="h-4 w-28" />
        <Skeleton className="ml-auto h-8 w-28" />
      </div>
      <div
        className={cn("space-y-0", overviewAnalyticCardContentPaddingClassName)}
      >
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="flex items-start gap-3 border-b border-border/60 py-3 last:border-0"
          >
            <Skeleton className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardCardGridSkeleton({
  cards = 4,
  className,
}: {
  cards?: number
  className?: string
}) {
  return (
    <div className={cn(dashboardGridTwoColClassName, className)}>
      {Array.from({ length: cards }, (_, i) => (
        <DashboardAnalyticCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function TrafficDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <DashboardKpiRowSkeleton count={4} />
      <DashboardCardGridSkeleton cards={4} />
      <DashboardAnalyticCardSkeleton className="lg:col-span-2" rows={5} />
    </div>
  )
}

export function OverviewDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <DashboardKpiRowSkeleton count={6} />
      <div className={dashboardGridFunnelChartClassName}>
        <DashboardAnalyticCardSkeleton rows={5} />
        <DashboardChartSkeleton />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <DashboardAnalyticCardSkeleton rows={4} />
          <DashboardAnalyticCardSkeleton rows={4} />
        </div>
        <DashboardAlertsListSkeleton />
      </div>
    </div>
  )
}

export function FunnelDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <DashboardKpiRowSkeleton count={4} />
      <DashboardCardGridSkeleton cards={2} />
    </div>
  )
}

export function EventTrackingDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <DashboardKpiRowSkeleton count={4} />
      <DashboardCardGridSkeleton cards={2} />
    </div>
  )
}

export function SegmentsDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <DashboardKpiRowSkeleton count={4} />
      <DashboardCardGridSkeleton cards={2} />
    </div>
  )
}

export function ExperimentsDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <DashboardCardGridSkeleton cards={4} />
    </div>
  )
}

export function SeoDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <DashboardKpiRowSkeleton count={4} />
      <DashboardAnalyticCardSkeleton rows={8} />
    </div>
  )
}

export function DataExportDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 pt-6">
      <DashboardKpiRowSkeleton count={2} />
      <DashboardAnalyticCardSkeleton rows={8} className="w-full" />
    </div>
  )
}

export function WebVitalDashboardSkeleton() {
  return (
    <div
      className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start"
      aria-busy
    >
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[120px] w-full rounded-xl" />
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <Skeleton className="min-h-[360px] w-full rounded-xl" />
        <DashboardAnalyticCardSkeleton rows={5} />
      </div>
    </div>
  )
}

export function AlertsDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <DashboardAlertsListSkeleton />
    </div>
  )
}

export function UtmDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <DashboardKpiRowSkeleton count={4} />
      <DashboardCardGridSkeleton cards={2} />
    </div>
  )
}

export function HeatmapDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <DashboardHeatmapSkeleton />
    </div>
  )
}

export function SettingsDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 pb-6" aria-busy>
      <div className="pt-2">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Manage project details, SDK tracking, publishing status, activity
          logs, and lifecycle actions.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        <div className="space-y-2 rounded-xl border border-border p-3">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
        <div className="min-w-0 space-y-4">
          <DashboardAnalyticCardSkeleton rows={8} />
        </div>
      </div>
    </div>
  )
}

export function Level1StatsSkeleton({
  count = 6,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
      aria-busy
      aria-hidden
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={cn(
            "flex min-h-[140px] flex-col rounded-[15px] border border-foreground/10 bg-card",
            overviewAnalyticCardShellClassName
          )}
        >
          <div className={overviewAnalyticCardHeaderClassName}>
            <Skeleton className="h-4 w-28" />
          </div>
          <div
            className={cn(
              "flex flex-1 flex-col gap-3",
              overviewAnalyticCardContentPaddingClassName
            )}
          >
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-4 w-44" />
          </div>
        </div>
      ))}
    </div>
  )
}
