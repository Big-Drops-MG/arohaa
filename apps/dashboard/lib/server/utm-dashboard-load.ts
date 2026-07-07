import { notFound } from "next/navigation"
import { and, asc, eq, inArray, notInArray, or, like } from "drizzle-orm"
import { db, landingPageUtmParams } from "@workspace/database"
import {
  STORED_UTM_PARAM_KEYS,
  isStoredUtmParamKey,
  sanitizeUtmParamValue,
  type StoredUtmParamKey,
} from "@workspace/lp-core"
import type { UtmDashboardData, UtmParamItem } from "@/features/utm/model/utm"
import { getUtmEmptyDashboardData } from "@/features/utm/controller/utm-empty-data"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"

export type UtmParamStatus = "active" | "blocked"

type DiscoveredUtmParam = {
  key: string
  value: string
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
  } catch {
    return []
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

async function purgeDisallowedUtmParams(landingPageId: string) {
  await db
    .delete(landingPageUtmParams)
    .where(
      and(
        eq(landingPageUtmParams.landingPageId, landingPageId),
        notInArray(landingPageUtmParams.key, [...STORED_UTM_PARAM_KEYS])
      )
    )
}

async function purgeMalformedUtmParams(landingPageId: string) {
  await db
    .delete(landingPageUtmParams)
    .where(
      and(
        eq(landingPageUtmParams.landingPageId, landingPageId),
        inArray(landingPageUtmParams.key, [...STORED_UTM_PARAM_KEYS]),
        or(
          like(landingPageUtmParams.value, "%&%"),
          like(landingPageUtmParams.value, "%?%"),
          and(
            eq(landingPageUtmParams.key, "utm_source"),
            like(landingPageUtmParams.value, "%=%")
          )
        )
      )
    )
}

async function syncDiscoveredParams(
  landingPageId: string,
  discovered: DiscoveredUtmParam[]
) {
  if (discovered.length === 0) return

  const existing = await db
    .select({
      key: landingPageUtmParams.key,
      value: landingPageUtmParams.value,
    })
    .from(landingPageUtmParams)
    .where(eq(landingPageUtmParams.landingPageId, landingPageId))

  const existingSet = new Set(existing.map((row) => `${row.key}::${row.value}`))

  const toInsert = discovered.filter(
    (row) => !existingSet.has(`${row.key}::${row.value}`)
  )

  if (toInsert.length === 0) return

  await db.insert(landingPageUtmParams).values(
    toInsert.map((row) => ({
      landingPageId,
      key: row.key,
      value: row.value,
      status: "active" as const,
    }))
  )
}

function buildDashboardData(
  brandName: string,
  items: UtmParamItem[]
): UtmDashboardData {
  const active = items.filter((item) => item.status === "active")
  const blocked = items.filter((item) => item.status === "blocked")
  const total = items.length
  const activePct =
    total > 0 ? Math.round((active.length / total) * 1000) / 10 : 0
  const blockedPct =
    total > 0 ? Math.round((blocked.length / total) * 1000) / 10 : 0

  return {
    brandName,
    stats: {
      total,
      active: active.length,
      blocked: blocked.length,
      activePct,
      blockedPct,
    },
    activeItems: active.map(({ key, value }) => ({ key, value })),
    blockedItems: blocked.map(({ key, value }) => ({ key, value })),
    items,
  }
}

export async function loadUtmDashboardData(
  landingPagePublicId: string
): Promise<UtmDashboardData> {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) notFound()

  await purgeDisallowedUtmParams(row.id)
  await purgeMalformedUtmParams(row.id)

  const discovered = sanitizeDiscovered(await fetchDiscoveredUtmParams(row.id))
  await syncDiscoveredParams(row.id, discovered)

  const rows = await db
    .select({
      key: landingPageUtmParams.key,
      value: landingPageUtmParams.value,
      status: landingPageUtmParams.status,
    })
    .from(landingPageUtmParams)
    .where(
      and(
        eq(landingPageUtmParams.landingPageId, row.id),
        inArray(landingPageUtmParams.key, [...STORED_UTM_PARAM_KEYS])
      )
    )
    .orderBy(asc(landingPageUtmParams.key), asc(landingPageUtmParams.value))

  const items: UtmParamItem[] = rows.map((r) => ({
    key: r.key,
    value: r.value,
    status: r.status,
  }))

  return buildDashboardData(row.brandName, items)
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
  const actor = await requireLandingPageActor()
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
    return { ok: true, data: await loadUtmDashboardData(landingPagePublicId) }
  }

  const values = [...new Set(valid.map((item) => item.value))]
  const keys = [...new Set(valid.map((item) => item.key))]

  const existing = await db
    .select({
      key: landingPageUtmParams.key,
      value: landingPageUtmParams.value,
    })
    .from(landingPageUtmParams)
    .where(
      and(
        eq(landingPageUtmParams.landingPageId, row.id),
        inArray(landingPageUtmParams.key, keys),
        inArray(landingPageUtmParams.value, values)
      )
    )

  const existingSet = new Set(
    existing.map((item) => `${item.key}::${item.value}`)
  )

  for (const item of valid) {
    const id = `${item.key}::${item.value}`
    if (existingSet.has(id)) {
      await db
        .update(landingPageUtmParams)
        .set({ status: item.status, updatedAt: new Date() })
        .where(
          and(
            eq(landingPageUtmParams.landingPageId, row.id),
            eq(landingPageUtmParams.key, item.key),
            eq(landingPageUtmParams.value, item.value)
          )
        )
    } else {
      await db.insert(landingPageUtmParams).values({
        landingPageId: row.id,
        key: item.key,
        value: item.value,
        status: item.status,
      })
    }
  }

  return { ok: true, data: await loadUtmDashboardData(landingPagePublicId) }
}

export async function loadUtmDashboardDataForApi(
  landingPagePublicId: string
): Promise<
  | { ok: true; data: UtmDashboardData }
  | { ok: false; status: number; error: string }
> {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) {
    return { ok: false, status: 404, error: "Not found" }
  }

  try {
    const data = await loadUtmDashboardData(landingPagePublicId)
    return { ok: true, data }
  } catch {
    return {
      ok: true,
      data: getUtmEmptyDashboardData(landingPagePublicId),
    }
  }
}
