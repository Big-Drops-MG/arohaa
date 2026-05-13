import { ProjectDashboardView } from "@/features/dashboard/view/ProjectDashboardView"

type ProjectPageProps = {
  params: Promise<{ project: string }>
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  await params
  return <ProjectDashboardView />
}
