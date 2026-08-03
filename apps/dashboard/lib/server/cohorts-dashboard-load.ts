import { notFound } from "next/navigation"
import type { CohortRetentionRow } from "@/features/retention/utils/retention-matrix"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"

export type CohortSplitBy = "utm_source" | "utm_campaign"

export async function loadCohortsForApi(
  landingPagePublicId: string,
  opts: {
    segmentId?: string | null
    splitBy?: CohortSplitBy | null
  } = {}
): Promise<
  | { ok: true; data: CohortRetentionRow[] }
  | { ok: false; status: number; error: string }
> {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) {
    return { ok: false, status: 404, error: "Landing page not found" }
  }

  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()
  if (!apiBase || !secret) {
    return { ok: false, status: 503, error: "Analytics not configured" }
  }

  const url = new URL(`${apiBase}/v1/analytics/cohorts`)
  url.searchParams.set("workspace_id", row.id)
  if (opts.segmentId) url.searchParams.set("segment_id", opts.segmentId)
  if (opts.splitBy) url.searchParams.set("split_by", opts.splitBy)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)

  try {
    const resp = await fetch(url.toString(), {
      headers: { "x-arohaa-internal": secret },
      signal: controller.signal,
      cache: "no-store",
    })
    if (!resp.ok) {
      const body = await resp.text().catch(() => "")
      console.error(
        `[cohorts] analytics API ${resp.status}`,
        body.slice(0, 200)
      )
      return { ok: false, status: 502, error: "Failed to load cohorts" }
    }
    const data = (await resp.json()) as CohortRetentionRow[]
    return { ok: true, data: Array.isArray(data) ? data : [] }
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      return { ok: false, status: 504, error: "Cohorts query timed out" }
    }
    console.error("[cohorts] analytics fetch failed", err)
    return { ok: false, status: 502, error: "Failed to load cohorts" }
  } finally {
    clearTimeout(timer)
  }
}

export async function loadCohortsDashboardData(
  landingPagePublicId: string,
  opts: {
    segmentId?: string | null
    splitBy?: CohortSplitBy | null
  } = {}
): Promise<CohortRetentionRow[]> {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()
  const result = await loadCohortsForApi(landingPagePublicId, opts)
  if (!result.ok) return []
  return result.data
}
