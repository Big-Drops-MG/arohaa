import type { Actor } from "@/lib/server/actor-can"
import { actorCan } from "@/lib/server/actor-can"

export async function canAccessDataExport(actor: Actor): Promise<boolean> {
  return actorCan(actor, "data_export.read")
}
