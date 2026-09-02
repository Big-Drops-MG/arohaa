import { getLandingPageList } from "@/features/dashboard/controller/landing-pages"
import { LandingPagesDashboard } from "@/features/dashboard/view/LandingPagesDashboard"
import { canWriteLandingPages } from "@/lib/server/actor-can"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { isExternalTeamKind } from "@/features/team/model/external-privileges"

export async function HomePage() {
  const [pages, actor] = await Promise.all([
    getLandingPageList(),
    requireLandingPageActor(),
  ])

  const canCreateProjects = Boolean(
    actor &&
    !isExternalTeamKind(actor.teamKind) &&
    (await canWriteLandingPages(actor))
  )

  return (
    <LandingPagesDashboard
      pages={pages}
      canCreateProjects={canCreateProjects}
    />
  )
}
