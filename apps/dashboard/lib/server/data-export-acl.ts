import type { Actor } from "@/lib/server/actor-can"
import { actorCan } from "@/lib/server/actor-can"
import { canAccessSection, getActorAccess } from "@/lib/server/external-access"

export async function canAccessDataExport(actor: Actor): Promise<boolean> {
  return actorCan(actor, "data_export.read")
}

export async function canAccessLeadsForLandingPage(
  actor: Actor,
  landingPagePublicId: string
): Promise<boolean> {
  const access = await getActorAccess(actor)
  if (access.isExternal) {
    return canAccessSection(access, landingPagePublicId, "data-lab", "leads")
  }
  return actorCan(actor, "data_export.read")
}
