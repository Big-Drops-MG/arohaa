import { parseNewLandingMode } from "@/features/dashboard/model/new-landing-mode"
import { NewLandingPage } from "@/features/dashboard/view/NewLandingPage"
import { canWriteLandingPages } from "@/lib/server/actor-can"
import { isExternalTeamKind } from "@/features/team/model/external-privileges"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { pageMetadata } from "@/lib/site-metadata"
import { redirect } from "next/navigation"

export const metadata = pageMetadata("Add Landing Page")

type NewLandingRouteProps = {
  searchParams: Promise<{ mode?: string; parent?: string }>
}

export default async function NewLandingRoute({
  searchParams,
}: NewLandingRouteProps) {
  const actor = await requireLandingPageActor()
  if (
    !actor ||
    isExternalTeamKind(actor.teamKind) ||
    !(await canWriteLandingPages(actor))
  ) {
    redirect("/dashboard")
  }

  const { mode, parent } = await searchParams

  return (
    <NewLandingPage
      mode={parseNewLandingMode(mode)}
      initialParentPublicId={parent?.trim() || null}
    />
  )
}
