import { TeamDashboard } from "@/features/team/view/TeamDashboard"
import { loadTeamDashboardData } from "@/lib/server/team-load"
import { pageMetadata } from "@/lib/site-metadata"

export const metadata = pageMetadata("Team")

export default async function TeamPage() {
  const data = await loadTeamDashboardData()
  return <TeamDashboard data={data} />
}
