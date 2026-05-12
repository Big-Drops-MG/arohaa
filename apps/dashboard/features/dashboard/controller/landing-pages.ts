import { desc, isNull } from "drizzle-orm"
import { db, landingPages } from "@workspace/database"
import {
  emptyLandingPageMetrics,
  type LandingPageListItem,
} from "@/features/dashboard/model/landing-page"

export async function getLandingPageList(): Promise<LandingPageListItem[]> {
  const rows = await db
    .select({
      publicId: landingPages.publicId,
      brandName: landingPages.brandName,
      landingPageUrl: landingPages.landingPageUrl,
    })
    .from(landingPages)
    .where(isNull(landingPages.deletedAt))
    .orderBy(desc(landingPages.createdAt))

  return rows.map((row) => ({
    ...row,
    metrics: emptyLandingPageMetrics,
  }))
}
