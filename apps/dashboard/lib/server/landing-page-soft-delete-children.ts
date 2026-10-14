import { eq } from "drizzle-orm"
import {
  db,
  externalMemberPrivileges,
  externalMemberProjectScopes,
  landingPageUtmParams,
} from "@workspace/database"

export type SoftDeleteChildExecutor = Pick<typeof db, "delete">

/**
 * Soft-delete does not cascade FK children. Purge access grants and the UTM
 * catalog so archived pages do not leave orphan rows.
 */
export async function purgeLandingPageSoftDeleteChildren(
  tx: SoftDeleteChildExecutor,
  row: { id: string; publicId: string }
): Promise<void> {
  await tx
    .delete(externalMemberPrivileges)
    .where(eq(externalMemberPrivileges.landingPagePublicId, row.publicId))

  await tx
    .delete(externalMemberProjectScopes)
    .where(eq(externalMemberProjectScopes.landingPagePublicId, row.publicId))

  await tx
    .delete(landingPageUtmParams)
    .where(eq(landingPageUtmParams.landingPageId, row.id))
}

export const SOFT_DELETE_CHILD_TABLES = [
  "external_member_privilege",
  "external_member_project_scope",
  "landing_page_utm_param",
] as const
