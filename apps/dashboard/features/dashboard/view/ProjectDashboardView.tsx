"use client"

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
import { SettingsDashboardSkeleton } from "@/features/dashboard/view/dashboard-skeletons"
import {
  useLazyProjectTabData,
  type ProjectTabData,
} from "@/hooks/use-lazy-project-tab-data"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import {
  DashboardNavigationProvider,
  useDashboardNavigation,
} from "@/hooks/use-dashboard-navigation"
import { useDashboardQueryParam } from "@/hooks/use-dashboard-query-param"

export type { ProjectTabValue }

type ProjectDashboardViewProps = {
  projectId: string
  formType: OverviewLandingFormType
  initialTab: ProjectTabValue
  rangeId: OverviewDateRangeId
  overviewPlaceholder: OverviewDashboardData
  initial: Partial<ProjectTabData>
}

function ProjectDashboardViewInner({
  projectId,
  formType,
  overviewPlaceholder,
  initial,
}: Omit<ProjectDashboardViewProps, "initialTab" | "rangeId">) {
  const { searchParams, isPending } = useDashboardNavigation()
  const [activeTab, setActiveTab] = useDashboardQueryParam("tab", {
    parse: parseProjectTab,
    projectId,
  })
  const { dateRangeId, customRange } = useDashboardDateRange()
  const { utmFilter } = useDashboardUtmFilter()

  // Remount tab bodies when shareable filters change so client state resets
  // with the soft-refreshed server payload (no hard window.reload).
  const panelKey = searchParams.toString()

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

  const isTabLoading = (tab: ProjectTabValue) => loadingTab === tab

  return (
    <div className="relative flex w-full flex-1 flex-col">
      {isPending ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden bg-neutral-200"
          aria-hidden
        >
          <div className="h-full w-1/3 animate-pulse bg-neutral-800" />
        </div>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(parseProjectTab(value))}
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

        <div
          className="mx-auto w-full max-w-[1440px] pb-10"
          aria-busy={isPending}
        >
          {PROJECT_TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              {activeTab !== tab.value ? null : tab.value === "overview" ? (
                <OverviewDashboard
                  key={panelKey}
                  data={overview}
                  projectId={projectId}
                  isLoading={isTabLoading("overview")}
                />
              ) : tab.value === "traffic" ? (
                <TrafficDashboard
                  key={panelKey}
                  data={traffic}
                  projectId={projectId}
                  isActive
                  isLoading={isTabLoading("traffic")}
                />
              ) : tab.value === "funnel" ? (
                <FunnelDashboard
                  key={panelKey}
                  data={funnel}
                  projectId={projectId}
                  isActive
                  isLoading={isTabLoading("funnel")}
                />
              ) : tab.value === "heatmap" ? (
                <HeatmapDashboard
                  key={panelKey}
                  data={heatmap}
                  projectId={projectId}
                  isActive
                  isLoading={isTabLoading("heatmap")}
                />
              ) : tab.value === "event-tracking" ? (
                <EventTrackingDashboard
                  key={panelKey}
                  data={eventTracking}
                  projectId={projectId}
                  isActive
                  isLoading={isTabLoading("event-tracking")}
                />
              ) : tab.value === "segments" ? (
                <SegmentsDashboard
                  key={panelKey}
                  data={segments}
                  projectId={projectId}
                  isActive
                  isLoading={isTabLoading("segments")}
                />
              ) : tab.value === "experiments" ? (
                <ExperimentsDashboard
                  key={panelKey}
                  data={experiments}
                  projectId={projectId}
                  isActive
                  isLoading={isTabLoading("experiments")}
                />
              ) : tab.value === "seo" ? (
                <SeoDashboard
                  key={panelKey}
                  data={seo}
                  projectId={projectId}
                  isActive
                  isLoading={isTabLoading("seo")}
                />
              ) : tab.value === "utm" ? (
                <UtmDashboard
                  key={panelKey}
                  data={utm}
                  projectId={projectId}
                  isActive
                  isLoading={isTabLoading("utm")}
                />
              ) : tab.value === "alerts" ? (
                <AlertsDashboard
                  key={panelKey}
                  data={alerts}
                  projectId={projectId}
                  isActive
                  isLoading={isTabLoading("alerts")}
                />
              ) : tab.value === "settings" && settings ? (
                <SettingsDashboard
                  key={panelKey}
                  initialData={settings}
                  projectId={projectId}
                />
              ) : tab.value === "settings" ? (
                <SettingsDashboardSkeleton />
              ) : null}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  )
}

export function ProjectDashboardView(props: ProjectDashboardViewProps) {
  return (
    <DashboardNavigationProvider>
      <ProjectDashboardViewInner {...props} />
    </DashboardNavigationProvider>
  )
}
