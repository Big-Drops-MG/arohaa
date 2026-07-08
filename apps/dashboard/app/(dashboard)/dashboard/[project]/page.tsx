import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ProjectDashboardView } from "@/features/dashboard/view/ProjectDashboardView"
import { parseProjectTab } from "@/features/dashboard/model/project-tab"
import { parseDashboardUtmFilter } from "@/features/dashboard/model/utm-attribution-filter"
import { getOverviewPlaceholderData } from "@/features/overview/controller/overview-placeholder-data"
import { parseOverviewLandingFormType } from "@/features/overview/model/overview"
import { parseTrafficRangeId } from "@/features/traffic/model/traffic-range"
import { loadAlertsDashboardData } from "@/lib/server/alerts-dashboard-load"
import { loadEventTrackingDashboardData } from "@/lib/server/event-tracking-dashboard-load"
import { loadExperimentsDashboardData } from "@/lib/server/experiments-dashboard-load"
import { loadFunnelDashboardData } from "@/lib/server/funnel-dashboard-load"
import { loadLandingPageSettingsData } from "@/lib/server/landing-page-settings-load"
import { loadOverviewDashboardData } from "@/lib/server/overview-dashboard-load"
import { loadSegmentsDashboardData } from "@/lib/server/segments-dashboard-load"
import { loadSeoDashboardData } from "@/lib/server/seo-dashboard-load"
import { loadUtmDashboardData } from "@/lib/server/utm-dashboard-load"
import { loadTrafficDashboardData } from "@/lib/server/traffic-dashboard-load"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { pageMetadata } from "@/lib/site-metadata"

type ProjectPageProps = {
  params: Promise<{ project: string }>
  searchParams: Promise<{
    range_id?: string
    tab?: string
    utm_dim?: string
    utm_value?: string
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
    tab: tabParam,
    utm_dim,
    utm_value,
  } = await searchParams
  const rangeId = parseTrafficRangeId(rangeIdParam)
  const tab = parseProjectTab(tabParam)
  const utmFilter = parseDashboardUtmFilter(utm_dim, utm_value)

  const actor = await requireLandingPageActor()
  if (!actor) notFound()

  const row = await getActiveLandingPageForActor(actor.id, project)
  if (!row) notFound()

  const formType = parseOverviewLandingFormType(row.formType)
  const overviewPlaceholder = getOverviewPlaceholderData(project, formType)

  let overview = null
  let traffic = null
  let funnel = null
  let eventTracking = null
  let segments = null
  let experiments = null
  let seo = null
  let utm = null
  let alerts = null
  let settings = null

  switch (tab) {
    case "overview":
      overview = await loadOverviewDashboardData(project, rangeId, utmFilter)
      break
    case "traffic":
      traffic = await loadTrafficDashboardData({
        landingPagePublicId: project,
        rangeId,
        utmFilter,
      })
      break
    case "funnel":
      funnel = await loadFunnelDashboardData({
        landingPagePublicId: project,
        rangeId,
        utmFilter,
      })
      break
    case "event-tracking":
      eventTracking = await loadEventTrackingDashboardData({
        landingPagePublicId: project,
        rangeId,
        utmFilter,
      })
      break
    case "segments":
      segments = await loadSegmentsDashboardData({
        landingPagePublicId: project,
        rangeId,
        utmFilter,
      })
      break
    case "experiments":
      experiments = await loadExperimentsDashboardData({
        landingPagePublicId: project,
        rangeId,
        utmFilter,
      })
      break
    case "seo":
      seo = await loadSeoDashboardData({
        landingPagePublicId: project,
        rangeId,
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
        initial={{
          overview: overview ?? undefined,
          traffic: traffic ?? undefined,
          funnel: funnel ?? undefined,
          "event-tracking": eventTracking ?? undefined,
          segments: segments ?? undefined,
          experiments: experiments ?? undefined,
          seo: seo ?? undefined,
          utm: utm ?? undefined,
          alerts: alerts ?? undefined,
          settings: settings ?? undefined,
        }}
      />
    </Suspense>
  )
}
