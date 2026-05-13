import { desc, isNull } from "drizzle-orm"
import { db, landingPages } from "@workspace/database"
import {
  emptyLandingPageMetrics,
  type LandingPageListItem,
  type LandingPageNavItem,
} from "@/features/dashboard/model/landing-page"

export async function getLandingPageNavItems(): Promise<LandingPageNavItem[]> {
  return db
    .select({
      publicId: landingPages.publicId,
      brandName: landingPages.brandName,
      faviconUrl: landingPages.faviconUrl,
    })
    .from(landingPages)
    .where(isNull(landingPages.deletedAt))
    .orderBy(desc(landingPages.createdAt))
}

export async function getLandingPageList(): Promise<LandingPageListItem[]> {
  const rows = await db
    .select({
      publicId: landingPages.publicId,
      brandName: landingPages.brandName,
      landingPageUrl: landingPages.landingPageUrl,
      faviconUrl: landingPages.faviconUrl,
    })
    .from(landingPages)
    .where(isNull(landingPages.deletedAt))
    .orderBy(desc(landingPages.createdAt))

  return rows.map((row) => ({
    ...row,
    metrics: emptyLandingPageMetrics,
  }))
}
