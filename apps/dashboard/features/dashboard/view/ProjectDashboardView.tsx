"use client"

import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { AlertsDashboard } from "@/features/alerts/view/AlertsDashboard"
import { EventTrackingDashboard } from "@/features/event-tracking/view/EventTrackingDashboard"
import { ExperimentsDashboard } from "@/features/experiments/view/ExperimentsDashboard"
import { FunnelDashboard } from "@/features/funnel/view/FunnelDashboard"
import { HeatmapDashboard } from "@/features/heatmap/view/HeatmapDashboard"
import type {
  OverviewDashboardData,
  OverviewDateRangeId,
  OverviewLandingFormType,
} from "@/features/overview/model/overview"
import { OverviewDashboard } from "@/features/overview/view/OverviewDashboard"
import { SegmentsDashboard } from "@/features/segments/view/SegmentsDashboard"
import { SeoDashboard } from "@/features/seo/view/SeoDashboard"
import { UtmDashboard } from "@/features/utm/view/UtmDashboard"
import { SettingsDashboard } from "@/features/settings/view/SettingsDashboard"
import { TrafficDashboard } from "@/features/traffic/view/TrafficDashboard"
import {
  PROJECT_TABS,
  parseProjectTab,
  type ProjectTabValue,
} from "@/features/dashboard/model/project-tab"
import {
  useLazyProjectTabData,
  type ProjectTabData,
} from "@/hooks/use-lazy-project-tab-data"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"

export type { ProjectTabValue }

type ProjectDashboardViewProps = {
  projectId: string
  formType: OverviewLandingFormType
  initialTab: ProjectTabValue
  rangeId: OverviewDateRangeId
  overviewPlaceholder: OverviewDashboardData
  initial: Partial<ProjectTabData>
}

function TabLoadingState({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-[240px] items-center justify-center px-6 py-12 text-sm text-muted-foreground"
      aria-busy
    >
      Loading {label}…
    </div>
  )
}

export function ProjectDashboardView({
  projectId,
  formType,
  initialTab,
  rangeId,
  overviewPlaceholder,
  initial,
}: ProjectDashboardViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = parseProjectTab(searchParams.get("tab") ?? initialTab)
  const { dateRangeId, customRange } = useDashboardDateRange()
  const { utmFilter } = useDashboardUtmFilter()

  const {
    overview,
    traffic,
    funnel,
    heatmap,
    eventTracking,
    segments,
    experiments,
    seo,
    utm,
    alerts,
    settings,
    loadingTab,
  } = useLazyProjectTabData({
    projectId,
    activeTab,
    rangeId: dateRangeId,
    customRange,
    utmFilter,
    formType,
    overviewPlaceholder,
    initial,
  })

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("tab", value)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const isTabLoading = (tab: ProjectTabValue) => loadingTab === tab

  return (
    <div className="flex w-full flex-1 flex-col">
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <div className="w-full border-b border-neutral-200 bg-neutral-50/90">
          <div className="mx-auto w-full max-w-[1440px]">
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
              {activeTab !== tab.value ? null : isTabLoading(tab.value) ? (
                <TabLoadingState label={tab.label} />
              ) : tab.value === "overview" ? (
                <OverviewDashboard data={overview} projectId={projectId} />
              ) : tab.value === "traffic" ? (
                <TrafficDashboard
                  data={traffic}
                  projectId={projectId}
                  isActive
                />
              ) : tab.value === "funnel" ? (
                <FunnelDashboard data={funnel} projectId={projectId} isActive />
              ) : tab.value === "heatmap" ? (
                <HeatmapDashboard
                  data={heatmap}
                  projectId={projectId}
                  isActive
                />
              ) : tab.value === "event-tracking" ? (
                <EventTrackingDashboard
                  data={eventTracking}
                  projectId={projectId}
                  isActive
                />
              ) : tab.value === "segments" ? (
                <SegmentsDashboard
                  data={segments}
                  projectId={projectId}
                  isActive
                />
              ) : tab.value === "experiments" ? (
                <ExperimentsDashboard
                  data={experiments}
                  projectId={projectId}
                  isActive
                />
              ) : tab.value === "seo" ? (
                <SeoDashboard data={seo} projectId={projectId} isActive />
              ) : tab.value === "utm" ? (
                <UtmDashboard data={utm} projectId={projectId} isActive />
              ) : tab.value === "alerts" ? (
                <AlertsDashboard data={alerts} projectId={projectId} isActive />
              ) : tab.value === "settings" && settings ? (
                <SettingsDashboard initialData={settings} />
              ) : tab.value === "settings" ? (
                <TabLoadingState label="Settings" />
              ) : null}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  )
}
