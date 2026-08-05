import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ProjectDashboardView } from "@/features/dashboard/view/ProjectDashboardView"
import { parseProjectTab } from "@/features/dashboard/model/project-tab"
import { parseDashboardUtmFilterFromParams } from "@/features/dashboard/model/utm-attribution-filter"
import {
  parseHeatmapDevice,
  parseHeatmapMode,
} from "@/features/heatmap/model/heatmap"
import { getOverviewPlaceholderData } from "@/features/overview/controller/overview-placeholder-data"
import { parseOverviewLandingFormType } from "@/features/overview/model/overview"
import {
  parseTrafficRangeId,
  parseDashboardCustomRange,
} from "@/features/traffic/model/traffic-range"
import { loadAlertsDashboardData } from "@/lib/server/alerts-dashboard-load"
import { loadEventTrackingDashboardData } from "@/lib/server/event-tracking-dashboard-load"
import { loadExperimentsDashboardData } from "@/lib/server/experiments-dashboard-load"
import { loadFunnelDashboardData } from "@/lib/server/funnel-dashboard-load"
import { loadHeatmapDashboardData } from "@/lib/server/heatmap-dashboard-load"
import { loadLandingPageSettingsData } from "@/lib/server/landing-page-settings-load"
import { loadOverviewDashboardData } from "@/lib/server/overview-dashboard-load"
import { loadSegmentsDashboardData } from "@/lib/server/segments-dashboard-load"
import { loadSeoDashboardData } from "@/lib/server/seo-dashboard-load"
import { loadWebVitalDashboardData } from "@/lib/server/web-vital-dashboard-load"
import { loadDataExportDashboardData } from "@/lib/server/data-export-dashboard-load"
import { canAccessDataExport } from "@/lib/server/data-export-acl"
import { loadUtmDashboardData } from "@/lib/server/utm-dashboard-load"
import { loadTrafficDashboardData } from "@/lib/server/traffic-dashboard-load"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { pageMetadata } from "@/lib/site-metadata"

type ProjectPageProps = {
  params: Promise<{ project: string }>
  searchParams: Promise<{
    range_id?: string
    from?: string
    to?: string
    tab?: string
    mode?: string
    device?: string
    section?: string
    sort_by?: string
    sort_order?: string
    utm_source?: string
    utm_s1?: string
    utm_medium?: string
    utm_dim?: string
    utm_value?: string
    segment_id?: string
  }>
}

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { project } = await params
  const actor = await requireLandingPageActor()
  if (!actor) {
    return pageMetadata("Project Not Found")
  }
  const row = await getActiveLandingPageForActor(actor.id, project)
  if (!row) {
    return pageMetadata("Project Not Found")
  }
  return pageMetadata(row.brandName)
}

export default async function ProjectPage({
  params,
  searchParams,
}: ProjectPageProps) {
  const { project } = await params
  const {
    range_id: rangeIdParam,
    from,
    to,
    tab: tabParam,
    mode: modeParam,
    device: deviceParam,
    utm_source,
    utm_s1,
    utm_dim,
    utm_value,
    segment_id,
  } = await searchParams
  const rangeId = parseTrafficRangeId(rangeIdParam)
  const customRange = parseDashboardCustomRange(from, to)
  const tab = parseProjectTab(tabParam)
  const utmFilter = parseDashboardUtmFilterFromParams({
    utm_source,
    utm_s1,
    utm_dim,
    utm_value,
    segment_id,
  })

  const actor = await requireLandingPageActor()
  if (!actor) notFound()

  const row = await getActiveLandingPageForActor(actor.id, project)
  if (!row) notFound()

  const formType = parseOverviewLandingFormType(row.formType)
  const overviewPlaceholder = getOverviewPlaceholderData(project, formType)
  const allowDataExport = canAccessDataExport(actor.email)

  if (tab === "data-export" && !allowDataExport) {
    notFound()
  }

  let overview = null
  let traffic = null
  let funnel = null
  let heatmap = null
  let eventTracking = null
  let segments = null
  let experiments = null
  let seo = null
  let webVital = null
  let dataExport = null
  let utm = null
  let alerts = null
  let settings = null

  switch (tab) {
    case "overview":
      overview = await loadOverviewDashboardData(
        project,
        rangeId,
        utmFilter,
        customRange
      )
      break
    case "traffic":
      traffic = await loadTrafficDashboardData({
        landingPagePublicId: project,
        rangeId,
        utmFilter,
        customRange,
      })
      break
    case "funnel":
      funnel = await loadFunnelDashboardData({
        landingPagePublicId: project,
        rangeId,
        utmFilter,
        customRange,
      })
      break
    case "heatmap":
      heatmap = await loadHeatmapDashboardData({
        landingPagePublicId: project,
        rangeId,
        customRange,
        mode: parseHeatmapMode(modeParam),
        device: parseHeatmapDevice(deviceParam),
      })
      break
    case "event-tracking":
      eventTracking = await loadEventTrackingDashboardData({
        landingPagePublicId: project,
        rangeId,
        utmFilter,
        customRange,
      })
      break
    case "segments":
      segments = await loadSegmentsDashboardData({
        landingPagePublicId: project,
        rangeId,
        utmFilter,
        customRange,
      })
      break
    case "experiments":
      experiments = await loadExperimentsDashboardData({
        landingPagePublicId: project,
        rangeId,
        utmFilter,
        customRange,
      })
      break
    case "seo":
      seo = await loadSeoDashboardData({
        landingPagePublicId: project,
        rangeId,
        customRange,
      })
      break
    case "web-vital":
      webVital = await loadWebVitalDashboardData({
        landingPagePublicId: project,
        rangeId,
        customRange,
      })
      break
    case "data-export":
      dataExport = await loadDataExportDashboardData({
        landingPagePublicId: project,
        rangeId,
        customRange,
      })
      break
    case "utm":
      utm = await loadUtmDashboardData(project)
      break
    case "alerts":
      alerts = await loadAlertsDashboardData({
        landingPagePublicId: project,
        rangeId,
        utmFilter,
        customRange,
      })
      break
    case "settings":
      settings = await loadLandingPageSettingsData(project)
      break
  }

  return (
    <Suspense>
      <ProjectDashboardView
        key={project}
        projectId={project}
        formType={formType}
        initialTab={tab}
        rangeId={rangeId}
        overviewPlaceholder={overviewPlaceholder}
        canAccessDataExport={allowDataExport}
        initial={{
          overview: overview ?? undefined,
          traffic: traffic ?? undefined,
          funnel: funnel ?? undefined,
          heatmap: heatmap ?? undefined,
          "event-tracking": eventTracking ?? undefined,
          segments: segments ?? undefined,
          experiments: experiments ?? undefined,
          seo: seo ?? undefined,
          "web-vital": webVital ?? undefined,
          "data-export": dataExport ?? undefined,
          utm: utm ?? undefined,
          alerts: alerts ?? undefined,
          settings: settings ?? undefined,
        }}
      />
    </Suspense>
  )
}
