import { Suspense } from "react"
import type { Metadata } from "next"
import { ProjectDashboardView } from "@/features/dashboard/view/ProjectDashboardView"
import { pageMetadata } from "@/lib/site-metadata"
import { loadOverviewDashboardData } from "@/lib/server/overview-dashboard-load"
import { getActiveLandingPageByPublicId } from "@/lib/server/landing-pages-store"

type ProjectPageProps = {
  params: Promise<{ project: string }>
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

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { project } = await params
  const overview = await loadOverviewDashboardData(project)
  return (
    <Suspense>
      <ProjectDashboardView key={project} overview={overview} />
    </Suspense>
  )
}
