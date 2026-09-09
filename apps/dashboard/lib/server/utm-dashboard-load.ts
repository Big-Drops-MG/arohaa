import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { db, landingPageUtmParams } from "@workspace/database"
import {
  STORED_UTM_PARAM_KEYS,
  isStoredUtmParamKey,
  sanitizeUtmParamValue,
  type StoredUtmParamKey,
} from "@workspace/lp-core/model"
import type {
  UtmDashboardData,
  UtmDashboardStats,
  UtmParamItem,
  UtmParamPair,
} from "@/features/utm/model/utm"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { requireWritableLandingPageActor } from "@/lib/server/external-access"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"

export type UtmParamStatus = "active" | "blocked"

export const UTM_UI_ACTIVE_PREVIEW_LIMIT = 250
export const UTM_UI_ACTIVE_PREVIEW_LIMIT_PER_KEY = 250

const UTM_DISCOVERY_SYNC_BATCH = 500

type DiscoveredUtmParam = {
  key: string
  value: string
}

type LandingPageRef = {
  id: string
  brandName: string
}

async function fetchDiscoveredUtmParams(
  workspaceId: string
): Promise<DiscoveredUtmParam[]> {
  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()
  if (!apiBase || !secret) return []

  try {
    const url = new URL(`${apiBase}/v1/analytics/utm-discovered`)
    url.searchParams.set("workspace_id", workspaceId)
    const resp = await fetch(url.toString(), {
      headers: { "x-arohaa-internal": secret },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    })
    if (!resp.ok) return []
    return (await resp.json()) as DiscoveredUtmParam[]
  } catch (err) {
    console.error("[utm] discovery fetch failed", err)
    return []
  }
}

async function invalidateApiBlockedUtmCache(landingPageId: string) {
  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()
  if (!apiBase || !secret) return

  try {
    await fetch(`${apiBase}/v1/internal/utm-blocked/invalidate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-arohaa-internal": secret,
      },
      body: JSON.stringify({ landingPageId }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    })
  } catch (err) {
    console.error("[utm] block-cache invalidate failed", err)
  }
}

function sanitizeDiscovered(rows: DiscoveredUtmParam[]): DiscoveredUtmParam[] {
  const seen = new Set<string>()
  const out: DiscoveredUtmParam[] = []
  for (const row of rows) {
    if (!isStoredUtmParamKey(row.key)) continue
    const value = sanitizeUtmParamValue(row.key, row.value)
    if (!value) continue
    const id = `${row.key}::${value}`
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ key: row.key, value })
  }
  return out
}

async function syncDiscoveredParams(
  landingPageId: string,
  discovered: DiscoveredUtmParam[]
) {
  if (discovered.length === 0) return

  for (const key of STORED_UTM_PARAM_KEYS) {
    const batch = discovered
      .filter((row) => row.key === key)
      .slice(0, UTM_DISCOVERY_SYNC_BATCH)
    if (batch.length === 0) continue

    await db
      .insert(landingPageUtmParams)
      .values(
        batch.map((row) => ({
          landingPageId,
          key: row.key,
          value: row.value,
          status: "active" as const,
        }))
      )
      .onConflictDoNothing({
        target: [
          landingPageUtmParams.landingPageId,
          landingPageUtmParams.key,
          landingPageUtmParams.value,
        ],
      })
  }
}

async function loadUtmStats(landingPageId: string): Promise<UtmDashboardStats> {
  const rows = await db
    .select({
      key: landingPageUtmParams.key,
      status: landingPageUtmParams.status,
      count: sql<number>`count(*)::int`,
    })
    .from(landingPageUtmParams)
    .where(
      and(
        eq(landingPageUtmParams.landingPageId, landingPageId),
        inArray(landingPageUtmParams.key, [...STORED_UTM_PARAM_KEYS])
      )
    )
    .groupBy(landingPageUtmParams.key, landingPageUtmParams.status)

  const stats: UtmDashboardStats = {
    total: 0,
    activeSource: 0,
    activeS1: 0,
    blockedSource: 0,
    blockedS1: 0,
  }

  for (const row of rows) {
    const n = Number(row.count) || 0
    stats.total += n
    if (row.key === "utm_source" && row.status === "active") {
      stats.activeSource = n
    } else if (row.key === "utm_s1" && row.status === "active") {
      stats.activeS1 = n
    } else if (row.key === "utm_source" && row.status === "blocked") {
      stats.blockedSource = n
    } else if (row.key === "utm_s1" && row.status === "blocked") {
      stats.blockedS1 = n
    }
  }

  return stats
}

async function loadUtmPairs(
  landingPageId: string,
  status: UtmParamStatus,
  options?: {
    limit?: number
    key?: StoredUtmParamKey
  }
): Promise<UtmParamPair[]> {
  const keys = options?.key ? [options.key] : [...STORED_UTM_PARAM_KEYS]
  const query = db
    .select({
      key: landingPageUtmParams.key,
      value: landingPageUtmParams.value,
    })
    .from(landingPageUtmParams)
    .where(
      and(
        eq(landingPageUtmParams.landingPageId, landingPageId),
        eq(landingPageUtmParams.status, status),
        inArray(landingPageUtmParams.key, keys)
      )
    )
    .orderBy(
      desc(landingPageUtmParams.updatedAt),
      asc(landingPageUtmParams.key),
      asc(landingPageUtmParams.value)
    )

  const rows = options?.limit ? await query.limit(options.limit) : await query
  return rows.map((row) => ({ key: row.key, value: row.value }))
}

async function loadActivePreviewPairs(
  landingPageId: string
): Promise<UtmParamPair[]> {
  const perKey = await Promise.all(
    STORED_UTM_PARAM_KEYS.map((key) =>
      loadUtmPairs(landingPageId, "active", {
        key,
        limit: UTM_UI_ACTIVE_PREVIEW_LIMIT_PER_KEY,
      })
    )
  )
  return perKey.flat()
}

function buildDashboardData(
  brandName: string,
  stats: UtmDashboardStats,
  activeItems: UtmParamPair[],
  blockedItems: UtmParamPair[]
): UtmDashboardData {
  const items: UtmParamItem[] = [
    ...activeItems.map((item) => ({ ...item, status: "active" as const })),
    ...blockedItems.map((item) => ({ ...item, status: "blocked" as const })),
  ]

  const previewedSource = activeItems.filter(
    (item) => item.key === "utm_source"
  ).length
  const previewedS1 = activeItems.filter((item) => item.key === "utm_s1").length

  return {
    brandName,
    stats,
    activeItems,
    blockedItems,
    items,
    previewLimit: UTM_UI_ACTIVE_PREVIEW_LIMIT_PER_KEY,
    activeTruncated:
      stats.activeSource > previewedSource || stats.activeS1 > previewedS1,
  }
}

async function resolveLandingPageForActor(
  landingPagePublicId: string
): Promise<
  | { ok: true; actorId: string; row: LandingPageRef }
  | { ok: false; status: 401 | 404; error: string }
> {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) {
    return { ok: false, status: 404, error: "Not found" }
  }

  return {
    ok: true,
    actorId: actor.id,
    row: { id: row.id, brandName: row.brandName },
  }
}

async function buildUtmDashboardForLandingPage(
  row: LandingPageRef
): Promise<UtmDashboardData> {
  try {
    const discovered = sanitizeDiscovered(
      await fetchDiscoveredUtmParams(row.id)
    )
    await syncDiscoveredParams(row.id, discovered)
  } catch (err) {
    console.error("[utm] discovery sync failed", err)
  }

  const [stats, activeItems, blockedItems] = await Promise.all([
    loadUtmStats(row.id),
    loadActivePreviewPairs(row.id),
    loadUtmPairs(row.id, "blocked"),
  ])

  return buildDashboardData(row.brandName, stats, activeItems, blockedItems)
}

export async function loadUtmDashboardData(
  landingPagePublicId: string
): Promise<UtmDashboardData> {
  const resolved = await resolveLandingPageForActor(landingPagePublicId)
  if (!resolved.ok) {
    const { notFound } = await import("next/navigation")
    notFound()
    throw new Error("Landing page not found")
  }

  return buildUtmDashboardForLandingPage(resolved.row)
}

export async function updateUtmParamsForLandingPage({
  landingPagePublicId,
  items,
}: {
  landingPagePublicId: string
  items: UtmParamItem[]
}): Promise<
  | { ok: true; data: UtmDashboardData }
  | { ok: false; status: number; error: string }
> {
  const actor = await requireWritableLandingPageActor()
  if (!actor) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) {
    return { ok: false, status: 404, error: "Not found" }
  }

  const valid = items
    .filter(
      (item) =>
        isStoredUtmParamKey(item.key) &&
        (item.status === "active" || item.status === "blocked")
    )
    .map((item) => ({
      key: item.key as StoredUtmParamKey,
      value: sanitizeUtmParamValue(item.key as StoredUtmParamKey, item.value),
      status: item.status,
    }))
    .filter((item) => item.value)

  if (valid.length === 0) {
    return { ok: true, data: await buildUtmDashboardForLandingPage(row) }
  }

  await db.transaction(async (tx) => {
    for (const item of valid) {
      await tx
        .insert(landingPageUtmParams)
        .values({
          landingPageId: row.id,
          key: item.key,
          value: item.value,
          status: item.status,
        })
        .onConflictDoUpdate({
          target: [
            landingPageUtmParams.landingPageId,
            landingPageUtmParams.key,
            landingPageUtmParams.value,
          ],
          set: {
            status: item.status,
            updatedAt: new Date(),
          },
        })
    }
  })

  await invalidateApiBlockedUtmCache(row.id)

  return { ok: true, data: await buildUtmDashboardForLandingPage(row) }
}

export async function loadUtmDashboardDataForApi(
  landingPagePublicId: string
): Promise<
  | { ok: true; data: UtmDashboardData }
  | { ok: false; status: number; error: string }
> {
  const resolved = await resolveLandingPageForActor(landingPagePublicId)
  if (!resolved.ok) {
    return { ok: false, status: resolved.status, error: resolved.error }
  }

  try {
    const data = await buildUtmDashboardForLandingPage(resolved.row)
    return { ok: true, data }
  } catch (err) {
    console.error("[utm] dashboard load failed", err)
    return {
      ok: false,
      status: 500,
      error: "Failed to load UTM controls",
    }
  }
}
