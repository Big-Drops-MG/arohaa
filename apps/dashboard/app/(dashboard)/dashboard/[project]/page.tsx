import { ProjectDashboardView } from "@/features/dashboard/view/ProjectDashboardView"
import { loadOverviewDashboardData } from "@/lib/server/overview-dashboard-load"

type ProjectPageProps = {
  params: Promise<{ project: string }>
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { project } = await params
  const overview = await loadOverviewDashboardData(project)
  return <ProjectDashboardView key={project} overview={overview} />
}
