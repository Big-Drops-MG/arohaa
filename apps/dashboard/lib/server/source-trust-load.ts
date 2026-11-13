import type { UtmSourceTrustRow } from "@/features/data-lab/model/utm-source-trust"
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

type SourceTrustApiResponse = {
  sources?: UtmSourceTrustRow[]
}

export async function loadSourceTrustForApi(
  landingPagePublicId: string,
  rangeIdRaw: string | null,
  customRange: DashboardCustomRange | undefined,
  utmFilter?: DashboardUtmFilter
): Promise<
  | { ok: true; data: { sources: UtmSourceTrustRow[] } }
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

  const url = new URL(`${apiBase}/v1/analytics/source-trust`)
  url.searchParams.set("workspace_id", row.id)
  url.searchParams.set("range_id", rangeId)
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
      console.error(`[source-trust] API ${res.status}`, body.slice(0, 200))
      return {
        ok: false,
        status: res.status === 403 ? 403 : 503,
        error: "Source trust unavailable",
      }
    }
    const json = (await res.json()) as SourceTrustApiResponse
    return { ok: true, data: { sources: json.sources ?? [] } }
  } catch (err) {
    const name =
      err && typeof err === "object" && "name" in err
        ? String((err as { name?: string }).name)
        : ""
    if (name === "AbortError") {
      console.warn("[source-trust] API request timed out")
    } else {
      console.error("[source-trust] API request failed", err)
    }
    return { ok: false, status: 503, error: "Source trust unavailable" }
  } finally {
    clearTimeout(timer)
  }
}
