import { desc, eq, isNull } from "drizzle-orm"
import {
  db,
  experiments,
  landingPages,
  normalizeExperimentVariantLinks,
} from "@workspace/database"
import type {
  LandingPageListItem,
  LandingPageNavItem,
} from "@/features/dashboard/model/landing-page"
import { parseLandingPageChannelType } from "@/features/settings/model/landing-page-channel-types"
import { fetchLandingPageCardMetrics } from "@/lib/server/landing-page-metrics-load"
import { isLandingPageLive } from "@/lib/server/landing-page-live"
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
      status: landingPages.status,
      formType: landingPages.formType,
      metadata: landingPages.metadata,
    })
    .from(landingPages)
    .where(isNull(landingPages.deletedAt))
    .orderBy(desc(landingPages.createdAt))

  const [metricsList, variantByLandingPageId] = await Promise.all([
    Promise.all(
      rows.map((row) => fetchLandingPageCardMetrics(row.id, row.formType))
    ),
    getVariantMembership(),
  ])

  return rows.map((row, index) => {
    const membership = variantByLandingPageId.get(row.id) ?? null
    return {
      publicId: row.publicId,
      brandName: row.brandName,
      landingPageUrl: row.landingPageUrl,
      faviconUrl: row.faviconUrl,
      isLive: isLandingPageLive(row.status),
      metrics: metricsList[index]!,
      channelType: parseLandingPageChannelType(
        row.metadata as Record<string, unknown> | null
      ),
      variantLabel: membership?.label ?? null,
      experimentName: membership?.experimentName ?? null,
      experimentGroupName: membership?.groupName ?? null,
    }
  })
}

type VariantMembership = {
  label: string
  experimentName: string
  /** Brand of the experiment owner, which reads better than the generated name. */
  groupName: string
}

async function getVariantMembership(): Promise<Map<string, VariantMembership>> {
  const rows = await db
    .select({
      name: experiments.name,
      variants: experiments.variants,
      ownerBrandName: landingPages.brandName,
    })
    .from(experiments)
    .leftJoin(landingPages, eq(landingPages.id, experiments.landingPageId))

  const membership = new Map<string, VariantMembership>()
  for (const row of rows) {
    for (const link of normalizeExperimentVariantLinks(row.variants)) {
      if (membership.has(link.landingPageId)) continue
      membership.set(link.landingPageId, {
        label: link.label,
        experimentName: row.name,
        groupName: row.ownerBrandName ?? row.name,
      })
    }
  }
  return membership
}
