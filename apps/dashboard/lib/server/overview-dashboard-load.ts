import { notFound } from "next/navigation"
import { getOverviewPlaceholderData } from "@/features/overview/controller/overview-placeholder-data"
import { parseOverviewLandingFormType } from "@/features/overview/model/overview"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageInWorkspace } from "@/lib/server/landing-pages-store"
import { getOrCreateOwnerWorkspace } from "@/lib/server/resolve-workspace"

export async function loadOverviewDashboardData(landingPagePublicId: string) {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()

  const ws = await getOrCreateOwnerWorkspace(actor.id)
  const row = await getActiveLandingPageInWorkspace(ws.id, landingPagePublicId)
  if (!row) notFound()

  const formType = parseOverviewLandingFormType(row.formType)
  return getOverviewPlaceholderData(landingPagePublicId, formType)
}
