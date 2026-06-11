import { ProjectDashboardView } from "@/features/dashboard/view/ProjectDashboardView"
import { loadAlertsDashboardData } from "@/lib/server/alerts-dashboard-load"
import { loadEventTrackingDashboardData } from "@/lib/server/event-tracking-dashboard-load"
import { loadFunnelDashboardData } from "@/lib/server/funnel-dashboard-load"
import { loadSegmentsDashboardData } from "@/lib/server/segments-dashboard-load"
import { loadExperimentsDashboardData } from "@/lib/server/experiments-dashboard-load"
import { parseTrafficRangeId } from "@/features/traffic/model/traffic-range"
import { loadOverviewDashboardData } from "@/lib/server/overview-dashboard-load"
import { loadTrafficDashboardData } from "@/lib/server/traffic-dashboard-load"

type ProjectPageProps = {
  params: Promise<{ project: string }>
  searchParams: Promise<{ range_id?: string }>
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
  ] = await Promise.all([
    loadOverviewDashboardData(project, rangeId),
    loadTrafficDashboardData({ landingPagePublicId: project, rangeId }),
    loadFunnelDashboardData({ landingPagePublicId: project, rangeId }),
    loadEventTrackingDashboardData({ landingPagePublicId: project, rangeId }),
    loadSegmentsDashboardData({ landingPagePublicId: project, rangeId }),
    loadExperimentsDashboardData({ landingPagePublicId: project, rangeId }),
    loadAlertsDashboardData({ landingPagePublicId: project, rangeId }),
  ])

  return (
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
    />
  )
}
