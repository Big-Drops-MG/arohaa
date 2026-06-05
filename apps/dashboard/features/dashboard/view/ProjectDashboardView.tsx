"use client"

import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import type { OverviewDashboardData } from "@/features/overview/model/overview"
import { OverviewDashboard } from "@/features/overview/view/OverviewDashboard"
import { FunnelDashboard } from "@/features/funnel/view/FunnelDashboard"
import { EventTrackingDashboard } from "@/features/event-tracking/view/EventTrackingDashboard"
import { AlertsDashboard } from "@/features/alerts/view/AlertsDashboard"
import { ExperimentsDashboard } from "@/features/experiments/view/ExperimentsDashboard"
import { SegmentsDashboard } from "@/features/segments/view/SegmentsDashboard"
import { TrafficDashboard } from "@/features/traffic/view/TrafficDashboard"
import { useSoftRefresh } from "@/hooks/use-soft-refresh"

const PROJECT_TABS = [
  { value: "overview", label: "Overview" },
  { value: "traffic", label: "Traffic" },
  { value: "funnel", label: "Funnel" },
  { value: "event-tracking", label: "Event Tracking" },
  { value: "segments", label: "Segments" },
  { value: "experiments", label: "Experiments" },
  { value: "alerts", label: "Alerts" },
  { value: "settings", label: "Settings" },
] as const

export type ProjectTabValue = (typeof PROJECT_TABS)[number]["value"]

const PROJECT_TAB_VALUES = new Set<string>(PROJECT_TABS.map((tab) => tab.value))

function parseProjectTab(value: string | null): ProjectTabValue {
  if (value && PROJECT_TAB_VALUES.has(value)) {
    return value as ProjectTabValue
  }
  return "overview"
}

type ProjectDashboardViewProps = {
  overview: OverviewDashboardData
}

export function ProjectDashboardView({ overview }: ProjectDashboardViewProps) {
  useSoftRefresh()

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = parseProjectTab(searchParams.get("tab"))

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("tab", value)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  return (
    <div className="flex w-full flex-1 flex-col">
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <div className="w-full border-b border-neutral-200 bg-neutral-50/90">
          <div className="mx-auto w-full max-w-[1440px] px-0">
            <TabsList className="h-auto min-h-11 justify-start rounded-none border-0 bg-transparent px-0">
              {PROJECT_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1440px] pb-10">
          {PROJECT_TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              {tab.value === "overview" ? (
                <OverviewDashboard data={overview} />
              ) : tab.value === "traffic" ? (
                <TrafficDashboard data={overview} />
              ) : tab.value === "funnel" ? (
                <FunnelDashboard data={overview} />
              ) : tab.value === "event-tracking" ? (
                <EventTrackingDashboard data={overview} />
              ) : tab.value === "segments" ? (
                <SegmentsDashboard data={overview} />
              ) : tab.value === "experiments" ? (
                <ExperimentsDashboard data={overview} />
              ) : tab.value === "alerts" ? (
                <AlertsDashboard data={overview} />
              ) : (
                <p className="max-w-prose px-4 pt-6 text-sm text-muted-foreground sm:px-6 lg:px-8">
                  <span className="font-medium text-foreground">
                    {tab.label}
                  </span>{" "}
                  for this landing page.
                </p>
              )}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  )
}
