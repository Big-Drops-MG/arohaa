import { desc, isNull } from "drizzle-orm"
import { db, landingPages } from "@workspace/database"
import type {
  LandingPageListItem,
  LandingPageNavItem,
} from "@/features/dashboard/model/landing-page"
import { fetchLandingPageCardMetrics } from "@/lib/server/landing-page-metrics-load"
import { requireLandingPageActor } from "@/lib/server/landing-auth"

export async function getLandingPageNavItems(): Promise<LandingPageNavItem[]> {
  const actor = await requireLandingPageActor()
  if (!actor) return []

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
  const actor = await requireLandingPageActor()
  if (!actor) return []

  const rows = await db
    .select({
      id: landingPages.id,
      publicId: landingPages.publicId,
      brandName: landingPages.brandName,
      landingPageUrl: landingPages.landingPageUrl,
      faviconUrl: landingPages.faviconUrl,
    })
    .from(landingPages)
    .where(isNull(landingPages.deletedAt))
    .orderBy(desc(landingPages.createdAt))

  const metricsList = await Promise.all(
    rows.map((row) => fetchLandingPageCardMetrics(row.id))
  )

  return rows.map((row, index) => ({
    publicId: row.publicId,
    brandName: row.brandName,
    landingPageUrl: row.landingPageUrl,
    faviconUrl: row.faviconUrl,
    metrics: metricsList[index]!,
  }))
}
