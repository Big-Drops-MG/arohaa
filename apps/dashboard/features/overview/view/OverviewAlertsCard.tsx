"use client"

import { useMemo } from "react"
import { AlertTriangle, Bell, CircleAlert } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import {
  overviewAnalyticCardContentPaddingClassName,
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"
import type {
  OverviewAlert,
  OverviewAlertSeverity,
} from "@/features/overview/model/overview"

type OverviewAlertsCardProps = {
  alerts: OverviewAlert[]
}

const severityOrder: OverviewAlertSeverity[] = ["error", "warning", "alert"]

function countBySeverity(
  items: OverviewAlert[]
): Record<OverviewAlertSeverity, number> {
  const counts: Record<OverviewAlertSeverity, number> = {
    warning: 0,
    alert: 0,
    error: 0,
  }
  for (const a of items) {
    counts[a.severity] += 1
  }
  return counts
}

function defaultSeverityTab(
  counts: Record<OverviewAlertSeverity, number>
): OverviewAlertSeverity {
  for (const s of severityOrder) {
    if (counts[s] > 0) return s
  }
  return "warning"
}

function alertsForSeverity(
  items: OverviewAlert[],
  severity: OverviewAlertSeverity
): OverviewAlert[] {
  return items.filter((a) => a.severity === severity)
}

function rowClassName(severity: OverviewAlertSeverity) {
  return cn(
    "flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm",
    severity === "warning" &&
      "bg-orange-50 text-orange-950 ring-1 ring-orange-200/80",
    severity === "alert" && "bg-sky-50 text-sky-950 ring-1 ring-sky-200/80",
    severity === "error" && "bg-red-50 text-red-950 ring-1 ring-red-200/80"
  )
}

function RowIcon({ severity }: { severity: OverviewAlertSeverity }) {
  if (severity === "warning") {
    return (
      <AlertTriangle
        className="mt-0.5 size-4 shrink-0 text-orange-600"
        aria-hidden
      />
    )
  }
  if (severity === "alert") {
    return <Bell className="mt-0.5 size-4 shrink-0 text-sky-600" aria-hidden />
  }
  return (
    <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden />
  )
}

const tabsListClassName =
  "h-auto w-auto shrink-0 justify-end gap-1 overflow-x-auto border-0 bg-transparent p-0"

const tabsTriggerClassName =
  "h-7 gap-1 rounded-md border-0 px-2 py-1 text-xs font-medium data-[state=active]:bg-muted data-[state=active]:shadow-none"

function emptyTabMessage(severity: OverviewAlertSeverity): string {
  if (severity === "warning") return "No warnings. All good."
  if (severity === "alert") return "No alerts. All good."
  return "No errors. All clear."
}

function AlertTabPanel({
  items,
  severity,
}: {
  items: OverviewAlert[]
  severity: OverviewAlertSeverity
}) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {emptyTabMessage(severity)}
      </p>
    )
  }
  return (
    <>
      {items.map((alert) => (
        <div key={alert.id} className={rowClassName(alert.severity)}>
          <RowIcon severity={alert.severity} />
          <span className="leading-snug font-medium">{alert.message}</span>
        </div>
      ))}
    </>
  )
}

export function OverviewAlertsCard({ alerts }: OverviewAlertsCardProps) {
  const counts = useMemo(() => countBySeverity(alerts), [alerts])
  const defaultTab = useMemo(() => defaultSeverityTab(counts), [counts])

  const bySeverity = useMemo(
    () => ({
      warning: alertsForSeverity(alerts, "warning"),
      alert: alertsForSeverity(alerts, "alert"),
      error: alertsForSeverity(alerts, "error"),
    }),
    [alerts]
  )

  const tabsResetKey = useMemo(
    () =>
      [
        counts.warning,
        counts.alert,
        counts.error,
        ...alerts.map((a) => `${a.id}:${a.severity}`),
      ].join("|"),
    [alerts, counts]
  )

  return (
    <Card
      className={cn(
        overviewCardPointerFocusResetClassName,
        overviewAnalyticCardShellClassName,
        "h-full min-h-0 flex-col"
      )}
    >
      <Tabs
        key={tabsResetKey}
        defaultValue={defaultTab}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <CardHeader
          className={cn(
            overviewAnalyticCardHeaderClassName,
            "flex-wrap justify-between gap-2 sm:flex-nowrap"
          )}
        >
          <CardTitle
            className={cn(overviewSectionHeadingClassName, "min-w-0 shrink")}
          >
            Alerts
          </CardTitle>
          <TabsList className={tabsListClassName}>
            <TabsTrigger
              value="warning"
              className={tabsTriggerClassName}
              aria-label={`Warnings, ${counts.warning}`}
            >
              <AlertTriangle
                className="size-3.5 shrink-0 text-orange-600"
                aria-hidden
              />
              <span className="tabular-nums">{counts.warning}</span>
            </TabsTrigger>
            <TabsTrigger
              value="alert"
              className={tabsTriggerClassName}
              aria-label={`Alerts, ${counts.alert}`}
            >
              <Bell className="size-3.5 shrink-0 text-sky-600" aria-hidden />
              <span className="tabular-nums">{counts.alert}</span>
            </TabsTrigger>
            <TabsTrigger
              value="error"
              className={tabsTriggerClassName}
              aria-label={`Errors, ${counts.error}`}
            >
              <CircleAlert
                className="size-3.5 shrink-0 text-red-600"
                aria-hidden
              />
              <span className="tabular-nums">{counts.error}</span>
            </TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-y-contain",
            "flex flex-col gap-2",
            overviewAnalyticCardContentPaddingClassName
          )}
        >
          <TabsContent
            value="warning"
            className="mt-0 flex flex-col gap-2 outline-none focus:outline-none focus-visible:outline-none data-[state=inactive]:hidden"
          >
            <AlertTabPanel items={bySeverity.warning} severity="warning" />
          </TabsContent>
          <TabsContent
            value="alert"
            className="mt-0 flex flex-col gap-2 outline-none focus:outline-none focus-visible:outline-none data-[state=inactive]:hidden"
          >
            <AlertTabPanel items={bySeverity.alert} severity="alert" />
          </TabsContent>
          <TabsContent
            value="error"
            className="mt-0 flex flex-col gap-2 outline-none focus:outline-none focus-visible:outline-none data-[state=inactive]:hidden"
          >
            <AlertTabPanel items={bySeverity.error} severity="error" />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  )
}
