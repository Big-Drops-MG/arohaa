import { ProjectDashboardView } from "@/features/dashboard/view/ProjectDashboardView"
import { getAlertsPlaceholderData } from "@/features/alerts/controller/alerts-placeholder-data"
import { getEventTrackingPlaceholderData } from "@/features/event-tracking/controller/event-tracking-placeholder-data"
import { getExperimentsPlaceholderData } from "@/features/experiments/controller/experiments-placeholder-data"
import { getSegmentsPlaceholderData } from "@/features/segments/controller/segments-placeholder-data"
import { loadFunnelDashboardData } from "@/lib/server/funnel-dashboard-load"
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
    Promise.resolve(getEventTrackingPlaceholderData(project)),
    Promise.resolve(getSegmentsPlaceholderData(project)),
    Promise.resolve(getExperimentsPlaceholderData(project)),
    Promise.resolve(getAlertsPlaceholderData(project)),
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
