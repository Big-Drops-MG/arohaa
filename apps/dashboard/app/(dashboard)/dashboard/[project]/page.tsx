import { Suspense } from "react"
import type { Metadata } from "next"
import { ProjectDashboardView } from "@/features/dashboard/view/ProjectDashboardView"
import { parseTrafficRangeId } from "@/features/traffic/model/traffic-range"
import { loadAlertsDashboardData } from "@/lib/server/alerts-dashboard-load"
import { loadEventTrackingDashboardData } from "@/lib/server/event-tracking-dashboard-load"
import { loadExperimentsDashboardData } from "@/lib/server/experiments-dashboard-load"
import { loadFunnelDashboardData } from "@/lib/server/funnel-dashboard-load"
import { loadLandingPageSettingsData } from "@/lib/server/landing-page-settings-load"
import { loadOverviewDashboardData } from "@/lib/server/overview-dashboard-load"
import { loadSegmentsDashboardData } from "@/lib/server/segments-dashboard-load"
import { loadTrafficDashboardData } from "@/lib/server/traffic-dashboard-load"
import { getActiveLandingPageByPublicId } from "@/lib/server/landing-pages-store"
import { pageMetadata } from "@/lib/site-metadata"

type ProjectPageProps = {
  params: Promise<{ project: string }>
  searchParams: Promise<{ range_id?: string }>
}

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { project } = await params
  const row = await getActiveLandingPageByPublicId(project)
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
  const { range_id: rangeIdParam } = await searchParams
  const rangeId = parseTrafficRangeId(rangeIdParam)

  const [
    overview,
    traffic,
    funnel,
    eventTracking,
    segments,
    experiments,
    alerts,
    settings,
  ] = await Promise.all([
    loadOverviewDashboardData(project, rangeId),
    loadTrafficDashboardData({ landingPagePublicId: project, rangeId }),
    loadFunnelDashboardData({ landingPagePublicId: project, rangeId }),
    loadEventTrackingDashboardData({ landingPagePublicId: project, rangeId }),
    loadSegmentsDashboardData({ landingPagePublicId: project, rangeId }),
    loadExperimentsDashboardData({ landingPagePublicId: project, rangeId }),
    loadAlertsDashboardData({ landingPagePublicId: project, rangeId }),
    loadLandingPageSettingsData(project),
  ])

  return (
    <Suspense>
      <ProjectDashboardView
        key={project}
        projectId={project}
        overview={overview}
        traffic={traffic}
        funnel={funnel}
        eventTracking={eventTracking}
        segments={segments}
        experiments={experiments}
        alerts={alerts}
        settings={settings}
      />
    </Suspense>
  )
}
