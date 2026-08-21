import { getLandingPageList } from "@/features/dashboard/controller/landing-pages"
import { LandingPagesDashboard } from "@/features/dashboard/view/LandingPagesDashboard"
import { isReadOnlyAccessLevel } from "@/features/team/model/access-level"
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
    !isReadOnlyAccessLevel(actor.accessLevel)
  )

  return (
    <LandingPagesDashboard
      pages={pages}
      canCreateProjects={canCreateProjects}
    />
  )
}
