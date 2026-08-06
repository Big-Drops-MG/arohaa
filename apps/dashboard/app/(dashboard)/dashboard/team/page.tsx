import { TeamDashboard } from "@/features/team/view/TeamDashboard"
import { isExternalTeamKind } from "@/features/team/model/external-privileges"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { loadTeamDashboardData } from "@/lib/server/team-load"
import { pageMetadata } from "@/lib/site-metadata"
import { redirect } from "next/navigation"

export const metadata = pageMetadata("Team")

export default async function TeamPage() {
  const actor = await requireLandingPageActor()
  if (!actor) redirect("/login")
  if (isExternalTeamKind(actor.teamKind)) redirect("/dashboard")

  const data = await loadTeamDashboardData()
  return <TeamDashboard data={data} />
}
