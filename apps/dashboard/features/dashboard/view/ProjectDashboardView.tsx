"use client"

import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import type { AlertsDashboardData } from "@/features/alerts/model/alerts"
import { AlertsDashboard } from "@/features/alerts/view/AlertsDashboard"
import type { EventTrackingDashboardData } from "@/features/event-tracking/model/event-tracking"
import { EventTrackingDashboard } from "@/features/event-tracking/view/EventTrackingDashboard"
import type { ExperimentsDashboardData } from "@/features/experiments/model/experiments"
import { ExperimentsDashboard } from "@/features/experiments/view/ExperimentsDashboard"
import type { FunnelDashboardData } from "@/features/funnel/model/funnel"
import { FunnelDashboard } from "@/features/funnel/view/FunnelDashboard"
import type { OverviewDashboardData } from "@/features/overview/model/overview"
import { OverviewDashboard } from "@/features/overview/view/OverviewDashboard"
import type { SegmentsDashboardData } from "@/features/segments/model/segments"
import { SegmentsDashboard } from "@/features/segments/view/SegmentsDashboard"
import type { LandingPageSettingsData } from "@/features/settings/model/landing-page-settings"
import { SettingsDashboard } from "@/features/settings/view/SettingsDashboard"
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

export type ProjectTabValue = (typeof PROJECT_TABS)[number]["value"]

const PROJECT_TAB_VALUES = new Set<string>(PROJECT_TABS.map((tab) => tab.value))

function parseProjectTab(value: string | null): ProjectTabValue {
  if (value && PROJECT_TAB_VALUES.has(value)) {
    return value as ProjectTabValue
  }
  return "overview"
}

type ProjectDashboardViewProps = {
  projectId: string
  overview: OverviewDashboardData
  traffic: TrafficDashboardData
  funnel: FunnelDashboardData
  eventTracking: EventTrackingDashboardData
  segments: SegmentsDashboardData
  experiments: ExperimentsDashboardData
  alerts: AlertsDashboardData
  settings: LandingPageSettingsData
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
  settings,
}: ProjectDashboardViewProps) {
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
                <OverviewDashboard data={overview} projectId={projectId} />
              ) : tab.value === "traffic" ? (
                <TrafficDashboard
                  data={traffic}
                  projectId={projectId}
                  isActive={activeTab === "traffic"}
                />
              ) : tab.value === "funnel" ? (
                <FunnelDashboard
                  data={funnel}
                  projectId={projectId}
                  isActive={activeTab === "funnel"}
                />
              ) : tab.value === "event-tracking" ? (
                <EventTrackingDashboard
                  data={eventTracking}
                  projectId={projectId}
                  isActive={activeTab === "event-tracking"}
                />
              ) : tab.value === "segments" ? (
                <SegmentsDashboard
                  data={segments}
                  projectId={projectId}
                  isActive={activeTab === "segments"}
                />
              ) : tab.value === "experiments" ? (
                <ExperimentsDashboard
                  data={experiments}
                  projectId={projectId}
                  isActive={activeTab === "experiments"}
                />
              ) : tab.value === "alerts" ? (
                <AlertsDashboard
                  data={alerts}
                  projectId={projectId}
                  isActive={activeTab === "alerts"}
                />
              ) : tab.value === "settings" ? (
                <SettingsDashboard initialData={settings} />
              ) : null}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  )
}
