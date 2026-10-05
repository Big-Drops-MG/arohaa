import type { LandingPageMetric } from "@/features/dashboard/model/landing-page"
import {
  emptyLandingPageMetrics,
  submissionMetricLabel,
} from "@/features/dashboard/model/landing-page"
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
  data: LandingPageCardMetrics,
  formType = "single"
): LandingPageMetric[] {
  return [
    { label: "Active Users", value: fmtCount(data.activeUsers) },
    {
      label: submissionMetricLabel(formType),
      value: fmtCount(data.formSubmissions),
    },
    { label: "Bounce Rate", value: fmtPct(data.bounceRate) },
  ]
}

export async function fetchLandingPageCardMetrics(
  landingPageId: string,
  formType = "single"
): Promise<LandingPageMetric[]> {
  const batch = await fetchLandingPageCardMetricsBatch([
    { landingPageId, formType },
  ])
  return batch[landingPageId] ?? emptyLandingPageMetrics(formType)
}

export async function fetchLandingPageCardMetricsBatch(
  pages: Array<{ landingPageId: string; formType?: string }>
): Promise<Record<string, LandingPageMetric[]>> {
  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()
  const result: Record<string, LandingPageMetric[]> = {}

  if (!apiBase || !secret || pages.length === 0) {
    for (const page of pages) {
      result[page.landingPageId] = emptyLandingPageMetrics(
        page.formType ?? "single"
      )
    }
    return result
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)

  try {
    const resp = await fetch(`${apiBase}/v1/analytics/landing-summary-batch`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-arohaa-internal": secret,
      },
      body: JSON.stringify({
        pages: pages.map((page) => ({
          workspace_id: page.landingPageId,
          ...(page.formType === "zip" ||
          page.formType === "single" ||
          page.formType === "multiple" ||
          page.formType === "none"
            ? { form_type: page.formType }
            : {}),
        })),
      }),
      signal: controller.signal,
      cache: "no-store",
    })

    if (!resp.ok) {
      const body = await resp.text().catch(() => "")
      console.error(
        `[landing-metrics] batch API ${resp.status}`,
        body.slice(0, 200)
      )
      for (const page of pages) {
        result[page.landingPageId] = emptyLandingPageMetrics(
          page.formType ?? "single"
        )
      }
      return result
    }

    const data = (await resp.json()) as {
      metricsByWorkspaceId?: Record<string, LandingPageCardMetrics>
    }

    for (const page of pages) {
      const metrics = data.metricsByWorkspaceId?.[page.landingPageId]
      result[page.landingPageId] = metrics
        ? buildLandingPageMetrics(metrics, page.formType ?? "single")
        : emptyLandingPageMetrics(page.formType ?? "single")
    }
    return result
  } catch (err: any) {
    if (err?.name === "AbortError") {
      console.warn("[landing-metrics] batch fetch timed out")
    } else {
      console.error("[landing-metrics] batch fetch failed", err?.message || err)
    }
    for (const page of pages) {
      result[page.landingPageId] = emptyLandingPageMetrics(
        page.formType ?? "single"
      )
    }
    return result
  } finally {
    clearTimeout(timer)
  }
}
