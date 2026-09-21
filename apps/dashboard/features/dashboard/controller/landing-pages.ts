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
import { fetchLandingPageCardMetrics } from "@/lib/server/landing-page-metrics-load"
import { isLandingPageLive } from "@/lib/server/landing-page-live"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { canAccessProject, getActorAccess } from "@/lib/server/external-access"

const METRICS_FETCH_CONCURRENCY = 6

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index]!, index)
    }
  }

  const workers = Math.min(Math.max(concurrency, 1), items.length)
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return results
}

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

  const [metricsList, variantByLandingPageId] = await Promise.all([
    mapWithConcurrency(visibleRows, METRICS_FETCH_CONCURRENCY, (row) =>
      fetchLandingPageCardMetrics(row.id, row.formType)
    ),
    getVariantMembership(),
  ])

  return visibleRows.map((row, index) => {
    const membership = variantByLandingPageId.get(row.id) ?? null
    return {
      publicId: row.publicId,
      slug: row.slug,
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

/** Lightweight metrics map for client refresh on /dashboard cards. */
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

  const metricsList = await mapWithConcurrency(
    visibleRows,
    METRICS_FETCH_CONCURRENCY,
    (row) => fetchLandingPageCardMetrics(row.id, row.formType)
  )

  const byPublicId: Record<string, LandingPageMetric[]> = {}
  for (let index = 0; index < visibleRows.length; index += 1) {
    byPublicId[visibleRows[index]!.publicId] = metricsList[index]!
  }
  return byPublicId
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
