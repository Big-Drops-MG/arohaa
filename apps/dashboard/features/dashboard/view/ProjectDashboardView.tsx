"use client"

import { useEffect, useMemo, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { AlertsDashboard } from "@/features/alerts/view/AlertsDashboard"
import { DataLabDashboard } from "@/features/data-lab/view/DataLabDashboard"
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
import { WebVitalDashboard } from "@/features/web-vital/view/WebVitalDashboard"
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
import { useDashboardSegmentFilter } from "@/hooks/use-dashboard-segment-filter"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import { useDashboardNavigation } from "@/hooks/use-dashboard-navigation"
import { useDashboardQueryParam } from "@/hooks/use-dashboard-query-param"
import { DashboardAccessProvider } from "@/features/dashboard/view/dashboard-access-context"
import { dashboardPageInsetClassName } from "@/features/overview/view/overview-card-density"
import { buildAnalyticsApiPath } from "@/lib/dashboard/analytics-query"
import {
  cacheDataLabResponse,
  fetchDataLabWithPriority,
} from "@/features/data-lab/model/data-lab-priority-fetch"
import { fetchDataLabStatsFromLeadsTable } from "@/features/data-lab/model/level1-from-leads"
import { hasCompleteLevel1Stats } from "@/features/data-lab/model/level1"
import { hasCompleteLevel3Stats } from "@/features/data-lab/model/level3"
import { DATA_EXPORT_PAGE_SIZE } from "@/features/data-export/model/data-export"

export type { ProjectTabValue }

type ProjectDashboardViewProps = {
  projectId: string
  formType: OverviewLandingFormType
  initialTab: ProjectTabValue
  rangeId: OverviewDateRangeId
  overviewPlaceholder: OverviewDashboardData
  initial: Partial<ProjectTabData>
  allowedTabs?: ProjectTabValue[] | null
  sectionsByTab?: Partial<Record<ProjectTabValue, string[]>> | null
  readOnly?: boolean
  lockedUtmSources?: string[] | null
  canAccessDataExport: boolean
}

function ProjectDashboardViewInner({
  projectId,
  formType,
  overviewPlaceholder,
  initial,
  allowedTabs = null,
  sectionsByTab = null,
  readOnly = false,
  lockedUtmSources = null,
  canAccessDataExport,
}: Omit<ProjectDashboardViewProps, "initialTab" | "rangeId">) {
  const { isPending } = useDashboardNavigation()
  const visibleTabs = useMemo(() => {
    if (allowedTabs && allowedTabs.length > 0) {
      return PROJECT_TABS.filter((tab) => allowedTabs.includes(tab.value))
    }
    return PROJECT_TABS
  }, [allowedTabs])

  const [activeTab, setActiveTab] = useDashboardQueryParam("tab", {
    parse: (value) => {
      const parsed = parseProjectTab(value)
      if (
        allowedTabs &&
        allowedTabs.length > 0 &&
        !allowedTabs.includes(parsed)
      ) {
        return allowedTabs[0]!
      }
      return parsed
    },
    projectId,
    omitDefault: true,
    // Tab bodies load via client fetch; refreshing RSC here races replace and
    // leaves the controlled Tabs on the previous value until a second click.
    refreshOnChange: false,
  })
  const { dateRangeId, customRange } = useDashboardDateRange()
  const { utmFilter, setUtmFilter } = useDashboardUtmFilter()
  const { segmentId } = useDashboardSegmentFilter()
  const dataLabPath = useMemo(() => {
    const path = buildAnalyticsApiPath(
      `/api/landing-pages/${encodeURIComponent(projectId)}/data-export`,
      { rangeId: dateRangeId, customRange }
    )
    const url = new URL(path, "http://local.invalid")
    url.searchParams.set("limit", "50")
    return `${url.pathname}${url.search}`
  }, [customRange, dateRangeId, projectId])
  const [dataLabPreload, setDataLabPreload] = useState<{
    requestKey: string
    data: ProjectTabData["data-export"] | null
    loading: boolean
  }>(() => ({
    requestKey: dataLabPath,
    data: initial["data-export"] ?? null,
    loading: !initial["data-export"],
  }))

  useEffect(() => {
    if (
      !canAccessDataExport ||
      !visibleTabs.some((tab) => tab.value === "data-lab")
    ) {
      return
    }

    const controller = new AbortController()
    setDataLabPreload((current) => ({
      requestKey: dataLabPath,
      data: current.requestKey === dataLabPath ? current.data : null,
      loading: true,
    }))

    void fetchDataLabWithPriority(dataLabPath, controller.signal)
      .then(async (data) => {
        const statsComplete =
          data.level1Complete &&
          hasCompleteLevel1Stats(data.level1Stats) &&
          data.level2Complete &&
          Array.isArray(data.level2Stats) &&
          data.level3Complete &&
          hasCompleteLevel3Stats(data.level3)
        let completeData = data
        if (!statsComplete) {
          const completeStats = await fetchDataLabStatsFromLeadsTable({
            projectId,
            dateRangeId,
            customRange,
            signal: controller.signal,
            seed: data,
          })
          completeData = {
            ...data,
            level1Stats: completeStats.level1Stats,
            level1Complete: true,
            level2Stats: completeStats.level2Stats,
            level2Complete: true,
            level3: completeStats.level3,
            level3Complete: true,
          }
        }

        const firstPageData = {
          ...completeData,
          leads: completeData.leads.slice(0, DATA_EXPORT_PAGE_SIZE),
          limit: DATA_EXPORT_PAGE_SIZE,
          offset: 0,
          hasMore: completeData.total > DATA_EXPORT_PAGE_SIZE,
        }
        cacheDataLabResponse(dataLabPath, firstPageData)
        return firstPageData
      })
      .then((data) => {
        if (controller.signal.aborted) return
        setDataLabPreload({
          requestKey: dataLabPath,
          data,
          loading: false,
        })
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setDataLabPreload((current) =>
          current.requestKey === dataLabPath
            ? { ...current, loading: false }
            : current
        )
        console.error("[data-lab] priority preload failed", error)
      })

    return () => controller.abort()
  }, [
    canAccessDataExport,
    customRange,
    dataLabPath,
    dateRangeId,
    projectId,
    visibleTabs,
  ])

  const preloadedDataLab =
    dataLabPreload.requestKey === dataLabPath ? dataLabPreload.data : null
  const preloadedDataLabLoading =
    dataLabPreload.requestKey !== dataLabPath || dataLabPreload.loading

  useEffect(() => {
    if (!lockedUtmSources || lockedUtmSources.length === 0) return
    const current = utmFilter?.utm_source ?? []
    const sameSources =
      current.length === lockedUtmSources.length &&
      lockedUtmSources.every((source) => current.includes(source)) &&
      !utmFilter?.utm_s1?.length
    if (sameSources) return
    setUtmFilter({ utm_source: lockedUtmSources })
  }, [lockedUtmSources, utmFilter, setUtmFilter])

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("arohaa:dashboard-tab", {
        detail: { projectPublicId: projectId, tab: activeTab },
      })
    )
  }, [activeTab, projectId])

  const {
    overview,
    traffic,
    funnel,
    heatmap,
    eventTracking,
    segments,
    experiments,
    seo,
    webVital,
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
    segmentId,
    formType,
    overviewPlaceholder,
    initial,
  })

  const isTabLoading = (tab: ProjectTabValue) => loadingTab === tab
  const settingsSections = sectionsByTab?.settings

  return (
    <DashboardAccessProvider
      value={{ readOnly, lockedUtmSources: lockedUtmSources ?? null }}
    >
      <div
        className="relative flex w-full flex-1 flex-col"
        data-project-public-id={projectId}
        data-dashboard-tab={activeTab}
      >
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
            <div
              className={cn(
                "mx-auto w-full max-w-360",
                dashboardPageInsetClassName
              )}
            >
              <TabsList className="h-auto min-h-11 flex-wrap justify-start gap-x-5 gap-y-1 rounded-none border-0 bg-transparent px-0">
                {visibleTabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>

          <div
            className={cn(
              "mx-auto w-full max-w-360 pb-8",
              dashboardPageInsetClassName
            )}
            aria-busy={isPending}
          >
            {visibleTabs.map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                {activeTab !== tab.value ? null : tab.value === "overview" ? (
                  <OverviewDashboard
                    data={overview}
                    projectId={projectId}
                    isLoading={isTabLoading("overview")}
                    allowedSections={sectionsByTab?.overview}
                  />
                ) : tab.value === "traffic" ? (
                  <TrafficDashboard
                    data={traffic}
                    projectId={projectId}
                    isActive
                    isLoading={isTabLoading("traffic")}
                    allowedSections={sectionsByTab?.traffic}
                  />
                ) : tab.value === "funnel" ? (
                  <FunnelDashboard
                    data={funnel}
                    projectId={projectId}
                    isActive
                    isLoading={isTabLoading("funnel")}
                  />
                ) : tab.value === "data-lab" ? (
                  <DataLabDashboard
                    projectId={projectId}
                    isActive
                    canAccessDataExport={canAccessDataExport}
                    allowedSections={sectionsByTab?.["data-lab"]}
                    initialDataExport={preloadedDataLab}
                    initialDataExportLoading={preloadedDataLabLoading}
                  />
                ) : tab.value === "heatmap" ? (
                  <HeatmapDashboard
                    data={heatmap}
                    projectId={projectId}
                    isActive
                    isLoading={isTabLoading("heatmap")}
                    allowedModes={sectionsByTab?.heatmap}
                  />
                ) : tab.value === "event-tracking" ? (
                  <EventTrackingDashboard
                    data={eventTracking}
                    projectId={projectId}
                    isActive
                    isLoading={isTabLoading("event-tracking")}
                  />
                ) : tab.value === "segments" ? (
                  <SegmentsDashboard
                    data={segments}
                    projectId={projectId}
                    isActive
                    isLoading={isTabLoading("segments")}
                    allowedViews={sectionsByTab?.segments}
                  />
                ) : tab.value === "experiments" ? (
                  <ExperimentsDashboard
                    data={experiments}
                    projectId={projectId}
                    isActive
                    isLoading={isTabLoading("experiments")}
                    readOnly={readOnly}
                  />
                ) : tab.value === "seo" ? (
                  <SeoDashboard
                    data={seo}
                    projectId={projectId}
                    isActive
                    isLoading={isTabLoading("seo")}
                  />
                ) : tab.value === "web-vital" ? (
                  <WebVitalDashboard
                    data={webVital}
                    projectId={projectId}
                    isActive
                    isLoading={isTabLoading("web-vital")}
                  />
                ) : tab.value === "utm" ? (
                  <UtmDashboard
                    data={utm}
                    projectId={projectId}
                    isActive
                    isLoading={isTabLoading("utm")}
                    readOnly={readOnly}
                  />
                ) : tab.value === "alerts" ? (
                  <AlertsDashboard
                    data={alerts}
                    projectId={projectId}
                    isActive
                    isLoading={isTabLoading("alerts")}
                  />
                ) : tab.value === "settings" && settings ? (
                  <SettingsDashboard
                    initialData={settings}
                    projectId={projectId}
                    allowedSections={settingsSections}
                    readOnly={readOnly}
                  />
                ) : tab.value === "settings" ? (
                  <SettingsDashboardSkeleton />
                ) : null}
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </div>
    </DashboardAccessProvider>
  )
}

export function ProjectDashboardView(props: ProjectDashboardViewProps) {
  return <ProjectDashboardViewInner {...props} />
}
