import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
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
import { canWriteLandingPages } from "@/lib/server/actor-can"
import { loadUtmDashboardData } from "@/lib/server/utm-dashboard-load"
import { loadTrafficDashboardData } from "@/lib/server/traffic-dashboard-load"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import {
  allowedSectionsForTab,
  allowedTabsForProject,
  canAccessProject,
  canAccessTab,
  getActorAccess,
  getForcedUtmSources,
} from "@/lib/server/external-access"
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
    lab?: string
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
  const rawSearchParams = await searchParams
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
  } = rawSearchParams
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

  const access = await getActorAccess(actor)
  const row = await getActiveLandingPageForActor(actor.id, project)
  if (!row) notFound()
  const publicId = row.publicId
  if (!canAccessProject(access, publicId)) redirect("/dashboard")

  if (project !== row.slug) {
    const legacyQuery = new URLSearchParams()
    for (const [key, value] of Object.entries(rawSearchParams)) {
      if (typeof value === "string" && value) legacyQuery.set(key, value)
    }
    const query = legacyQuery.toString()
    redirect(
      `/dashboard/${encodeURIComponent(row.slug)}${query ? `?${query}` : ""}`
    )
  }

  const allowedTabs = allowedTabsForProject(access, publicId)
  let effectiveTab = tab
  if (allowedTabs) {
    if (allowedTabs.length === 0) {
      redirect("/dashboard")
    }
    if (!canAccessTab(access, publicId, tab)) {
      effectiveTab = allowedTabs[0]!
    }
  }

  const formType = parseOverviewLandingFormType(row.formType)
  const overviewPlaceholder = getOverviewPlaceholderData(publicId, formType)
  const actorReadOnly =
    access.isExternal || !(await canWriteLandingPages(actor))
  const allowDataExport = (await canAccessDataExport(actor)) && !actorReadOnly

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

  const wantsLeadsSeed =
    allowDataExport &&
    (tabParam === "data-export" || effectiveTab === "data-lab")

  switch (effectiveTab) {
    case "overview":
      overview = await loadOverviewDashboardData(
        publicId,
        rangeId,
        utmFilter,
        customRange
      )
      break
    case "traffic":
      traffic = await loadTrafficDashboardData({
        landingPagePublicId: publicId,
        rangeId,
        utmFilter,
        customRange,
      })
      break
    case "funnel":
      funnel = await loadFunnelDashboardData({
        landingPagePublicId: publicId,
        rangeId,
        utmFilter,
        customRange,
      })
      break
    case "heatmap":
      heatmap = await loadHeatmapDashboardData({
        landingPagePublicId: publicId,
        rangeId,
        customRange,
        mode: parseHeatmapMode(modeParam),
        device: parseHeatmapDevice(deviceParam),
      })
      break
    case "event-tracking":
      eventTracking = await loadEventTrackingDashboardData({
        landingPagePublicId: publicId,
        rangeId,
        utmFilter,
        customRange,
      })
      break
    case "segments":
      segments = await loadSegmentsDashboardData({
        landingPagePublicId: publicId,
        rangeId,
        utmFilter,
        customRange,
      })
      break
    case "experiments":
      experiments = await loadExperimentsDashboardData({
        landingPagePublicId: publicId,
        rangeId,
        utmFilter,
        customRange,
      })
      break
    case "seo":
      seo = await loadSeoDashboardData({
        landingPagePublicId: publicId,
        rangeId,
        customRange,
      })
      break
    case "web-vital":
      webVital = await loadWebVitalDashboardData({
        landingPagePublicId: publicId,
        rangeId,
        customRange,
      })
      break
    case "utm":
      utm = await loadUtmDashboardData(publicId)
      break
    case "alerts":
      alerts = await loadAlertsDashboardData({
        landingPagePublicId: publicId,
        rangeId,
        utmFilter,
        customRange,
      })
      break
    case "settings":
      settings = await loadLandingPageSettingsData(publicId)
      break
    case "data-lab":
      break
  }

  if (wantsLeadsSeed) {
    dataExport = await loadDataExportDashboardData({
      landingPagePublicId: publicId,
      rangeId,
      customRange,
    })
  }

  const sectionsByTab = access.isExternal
    ? Object.fromEntries(
        (allowedTabs ?? []).map((tabValue) => [
          tabValue,
          allowedSectionsForTab(access, publicId, tabValue) ?? [],
        ])
      )
    : null

  const lockedUtmSources = getForcedUtmSources(access, publicId)

  return (
    <Suspense>
      <ProjectDashboardView
        key={publicId}
        projectId={publicId}
        formType={formType}
        initialTab={effectiveTab}
        rangeId={rangeId}
        overviewPlaceholder={overviewPlaceholder}
        allowedTabs={allowedTabs}
        sectionsByTab={sectionsByTab}
        readOnly={actorReadOnly}
        lockedUtmSources={lockedUtmSources}
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
