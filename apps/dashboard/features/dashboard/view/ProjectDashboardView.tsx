"use client"

import { useState } from "react"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import type { OverviewDashboardData } from "@/features/overview/model/overview"
import { OverviewDashboard } from "@/features/overview/view/OverviewDashboard"
import type { AlertsDashboardData } from "@/features/alerts/model/alerts"
import { AlertsDashboard } from "@/features/alerts/view/AlertsDashboard"
import type { EventTrackingDashboardData } from "@/features/event-tracking/model/event-tracking"
import { EventTrackingDashboard } from "@/features/event-tracking/view/EventTrackingDashboard"
import type { ExperimentsDashboardData } from "@/features/experiments/model/experiments"
import { ExperimentsDashboard } from "@/features/experiments/view/ExperimentsDashboard"
import type { SegmentsDashboardData } from "@/features/segments/model/segments"
import { SegmentsDashboard } from "@/features/segments/view/SegmentsDashboard"
import type { FunnelDashboardData } from "@/features/funnel/model/funnel"
import { FunnelDashboard } from "@/features/funnel/view/FunnelDashboard"
import type { TrafficDashboardData } from "@/features/traffic/model/traffic"
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

type ProjectDashboardViewProps = {
  projectId: string
  overview: OverviewDashboardData
  traffic: TrafficDashboardData
  funnel: FunnelDashboardData
  eventTracking: EventTrackingDashboardData
  segments: SegmentsDashboardData
  experiments: ExperimentsDashboardData
  alerts: AlertsDashboardData
}

export function ProjectDashboardView({
  projectId,
  overview,
  traffic,
  funnel,
  eventTracking,
  segments,
  experiments,
  alerts,
}: ProjectDashboardViewProps) {
  const [activeTab, setActiveTab] = useState("overview")
  useSoftRefresh()

  return (
    <div className="flex w-full flex-1 flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
                <TrafficDashboard
                  data={traffic}
                  projectId={projectId}
                  isActive={activeTab === "traffic"}
                />
              ) : tab.value === "funnel" ? (
                <FunnelDashboard data={funnel} />
              ) : tab.value === "event-tracking" ? (
                <EventTrackingDashboard data={eventTracking} />
              ) : tab.value === "segments" ? (
                <SegmentsDashboard data={segments} />
              ) : tab.value === "experiments" ? (
                <ExperimentsDashboard data={experiments} />
              ) : tab.value === "alerts" ? (
                <AlertsDashboard data={alerts} />
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
