import { desc, eq, isNull } from "drizzle-orm"
import {
  db,
  experiments,
  landingPages,
  normalizeExperimentVariantLinks,
} from "@workspace/database"
import type {
  LandingPageListItem,
  LandingPageMetric,
  LandingPageNavItem,
} from "@/features/dashboard/model/landing-page"
import { parseLandingPageChannelType } from "@/features/settings/model/landing-page-channel-types"
import { fetchLandingPageCardMetricsBatch } from "@/lib/server/landing-page-metrics-load"
import { isLandingPageLive } from "@/lib/server/landing-page-live"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { canAccessProject, getActorAccess } from "@/lib/server/external-access"

export async function getLandingPageNavItems(): Promise<LandingPageNavItem[]> {
  const actor = await requireLandingPageActor()
  if (!actor) return []

  const access = await getActorAccess(actor)

  const rows = await db
    .select({
      publicId: landingPages.publicId,
      slug: landingPages.slug,
      brandName: landingPages.brandName,
      faviconUrl: landingPages.faviconUrl,
    })
    .from(landingPages)
    .where(isNull(landingPages.deletedAt))
    .orderBy(desc(landingPages.createdAt))

  return rows.filter((row) => canAccessProject(access, row.publicId))
}

export async function getLandingPageList(): Promise<LandingPageListItem[]> {
  const actor = await requireLandingPageActor()
  if (!actor) return []

  const access = await getActorAccess(actor)

  const rows = await db
    .select({
      id: landingPages.id,
      publicId: landingPages.publicId,
      slug: landingPages.slug,
      brandName: landingPages.brandName,
      brand: landingPages.brand,
      landingPageUrl: landingPages.landingPageUrl,
      faviconUrl: landingPages.faviconUrl,
      status: landingPages.status,
      formType: landingPages.formType,
      metadata: landingPages.metadata,
    })
    .from(landingPages)
    .where(isNull(landingPages.deletedAt))
    .orderBy(desc(landingPages.createdAt))

  const visibleRows = rows.filter((row) =>
    canAccessProject(access, row.publicId)
  )

  const [metricsByLandingPageId, variantByLandingPageId] = await Promise.all([
    fetchLandingPageCardMetricsBatch(
      visibleRows.map((row) => ({
        landingPageId: row.id,
        formType: row.formType,
      }))
    ),
    getVariantMembership(),
  ])

  const idToPublicId = new Map(
    visibleRows.map((row) => [row.id, row.publicId] as const)
  )

  return visibleRows.map((row) => {
    const membership = variantByLandingPageId.get(row.id) ?? null
    const hubPublicId = membership?.hubLandingPageId
      ? (idToPublicId.get(membership.hubLandingPageId) ?? null)
      : null
    return {
      publicId: row.publicId,
      slug: row.slug,
      brandName: row.brandName,
      brand: row.brand?.trim() || null,
      landingPageUrl: row.landingPageUrl,
      faviconUrl: row.faviconUrl,
      isLive: isLandingPageLive(row.status),
      metrics: metricsByLandingPageId[row.id]!,
      channelType: parseLandingPageChannelType(
        row.metadata as Record<string, unknown> | null
      ),
      variantLabel: membership?.label ?? null,
      experimentName: membership?.experimentName ?? null,
      experimentGroupName: membership?.groupName ?? null,
      experimentId: membership?.experimentId ?? null,
      hubPublicId,
    }
  })
}

export async function getLandingPageCardMetricsByPublicId(): Promise<
  Record<string, LandingPageMetric[]>
> {
  const actor = await requireLandingPageActor()
  if (!actor) return {}

  const access = await getActorAccess(actor)

  const rows = await db
    .select({
      id: landingPages.id,
      publicId: landingPages.publicId,
      formType: landingPages.formType,
    })
    .from(landingPages)
    .where(isNull(landingPages.deletedAt))

  const visibleRows = rows.filter((row) =>
    canAccessProject(access, row.publicId)
  )

  const metricsByLandingPageId = await fetchLandingPageCardMetricsBatch(
    visibleRows.map((row) => ({
      landingPageId: row.id,
      formType: row.formType,
    }))
  )

  const byPublicId: Record<string, LandingPageMetric[]> = {}
  for (const row of visibleRows) {
    byPublicId[row.publicId] = metricsByLandingPageId[row.id]!
  }
  return byPublicId
}

type VariantMembership = {
  label: string
  experimentName: string
  groupName: string
  experimentId: string
  hubLandingPageId: string
}

async function getVariantMembership(): Promise<Map<string, VariantMembership>> {
  const rows = await db
    .select({
      id: experiments.id,
      name: experiments.name,
      variants: experiments.variants,
      hubLandingPageId: experiments.landingPageId,
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
        experimentId: row.id,
        hubLandingPageId: row.hubLandingPageId,
      })
    }
  }
  return membership
}
