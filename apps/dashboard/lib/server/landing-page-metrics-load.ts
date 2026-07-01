import type { LandingPageMetric } from "@/features/dashboard/model/landing-page"
import { emptyLandingPageMetrics } from "@/features/dashboard/model/landing-page"
import type { LandingPageCardMetrics } from "@/lib/server/analytics-types"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"

function fmtCount(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 10_000) return `${(v / 1_000).toFixed(1)}K`
  if (v >= 1_000) return v.toLocaleString("en-US")
  return String(v)
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`
}

export function buildLandingPageMetrics(
  data: LandingPageCardMetrics
): LandingPageMetric[] {
  return [
    { label: "Active Users", value: fmtCount(data.activeUsers) },
    { label: "Form Submissions", value: fmtCount(data.formSubmissions7d) },
    { label: "Bounce Rate", value: fmtPct(data.bounceRate7d) },
  ]
}

export async function fetchLandingPageCardMetrics(
  landingPageId: string
): Promise<LandingPageMetric[]> {
  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()

  if (!apiBase || !secret) {
    return emptyLandingPageMetrics
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5_000)

  try {
    const resp = await fetch(
      `${apiBase}/v1/analytics/landing-summary?workspace_id=${encodeURIComponent(landingPageId)}`,
      {
        headers: { "x-arohaa-internal": secret },
        signal: controller.signal,
        cache: "no-store",
      }
    )

    if (!resp.ok) {
      if (process.env.NODE_ENV === "development") {
        const body = await resp.text().catch(() => "")
        console.error(
          `[landing-metrics] API ${resp.status} ${apiBase}/v1/analytics/landing-summary`,
          body.slice(0, 200)
        )
      }
      return emptyLandingPageMetrics
    }

    const data = (await resp.json()) as LandingPageCardMetrics
    return buildLandingPageMetrics(data)
  } catch (err: any) {
    if (err.name === "AbortError") {
      if (process.env.NODE_ENV === "development") {
        console.warn("[landing-metrics] fetch timed out")
      }
      return emptyLandingPageMetrics
    }
    if (process.env.NODE_ENV === "development") {
      console.error("[landing-metrics] fetch failed", err?.message || err)
    }
    return emptyLandingPageMetrics
  } finally {
    clearTimeout(timer)
  }
}
