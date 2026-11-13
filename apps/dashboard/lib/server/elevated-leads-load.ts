import type { DataExportLeadRow } from "@/features/data-export/model/data-export"
import type { DashboardUtmFilter } from "@/features/dashboard/model/utm-attribution-filter"
import type { DashboardCustomRange } from "@/features/traffic/model/traffic-range"
import {
  buildInternalUserDelegationHeaders,
  FUNNEL_LEADS_DELEGATION_SCOPE,
} from "@workspace/database"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import {
  appendDashboardCustomRangeParams,
  appendDashboardUtmParams,
  resolveUtmFilterForActor,
} from "@/lib/server/analytics-utm-params"
import { canAccessLeadsForLandingPage } from "@/lib/server/data-export-acl"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import type { RangeId } from "@/lib/server/analytics-types"

export type ElevatedLeadsApiData = {
  leads: DataExportLeadRow[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export async function loadElevatedLeadsForApi(
  landingPagePublicId: string,
  rangeIdRaw: string | null,
  customRange: DashboardCustomRange | undefined,
  utmFilter: DashboardUtmFilter | undefined,
  limitRaw: string | null,
  offsetRaw: string | null
): Promise<
  | { ok: true; data: ElevatedLeadsApiData }
  | { ok: false; status: number; error: string }
> {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }
  if (!(await canAccessLeadsForLandingPage(actor, landingPagePublicId))) {
    return { ok: false, status: 403, error: "Forbidden" }
  }

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) {
    return { ok: false, status: 404, error: "Not found" }
  }

  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()
  if (!apiBase || !secret) {
    return { ok: false, status: 503, error: "Analytics unavailable" }
  }

  const rangeId = (rangeIdRaw || "7d") as RangeId
  const limit = Math.max(1, Math.min(100, Number(limitRaw ?? 50) || 50))
  const offset = Math.max(0, Number(offsetRaw ?? 0) || 0)
  const scopedUtmFilter = await resolveUtmFilterForActor(
    actor,
    landingPagePublicId,
    utmFilter
  )

  const delegationHeaders = buildInternalUserDelegationHeaders(secret, {
    userId: actor.id,
    landingPageId: row.id,
    scope: FUNNEL_LEADS_DELEGATION_SCOPE,
  })

  const url = new URL(`${apiBase}/v1/analytics/elevated-leads`)
  url.searchParams.set("workspace_id", row.id)
  url.searchParams.set("range_id", rangeId)
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("offset", String(offset))
  appendDashboardCustomRangeParams(url, rangeId, customRange)
  appendDashboardUtmParams(url, scopedUtmFilter)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45_000)
  try {
    const res = await fetch(url.toString(), {
      headers: {
        "x-arohaa-internal": secret,
        ...delegationHeaders,
      },
      signal: controller.signal,
      cache: "no-store",
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.error(`[elevated-leads] API ${res.status}`, body.slice(0, 200))
      return {
        ok: false,
        status: res.status === 403 ? 403 : 503,
        error: "Elevated leads unavailable",
      }
    }
    const json = (await res.json()) as Partial<ElevatedLeadsApiData>
    return {
      ok: true,
      data: {
        leads: json.leads ?? [],
        total: Number(json.total ?? 0) || 0,
        limit: Number(json.limit ?? limit) || limit,
        offset: Number(json.offset ?? offset) || offset,
        hasMore: Boolean(json.hasMore),
      },
    }
  } catch (err) {
    const name =
      err && typeof err === "object" && "name" in err
        ? String((err as { name?: string }).name)
        : ""
    if (name === "AbortError") {
      console.warn("[elevated-leads] API request timed out")
    } else {
      console.error("[elevated-leads] API request failed", err)
    }
    return { ok: false, status: 503, error: "Elevated leads unavailable" }
  } finally {
    clearTimeout(timer)
  }
}
