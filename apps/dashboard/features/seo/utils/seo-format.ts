import type { SeoSummary } from "@/features/seo/model/seo"

function fmtCount(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 10_000) return `${(v / 1_000).toFixed(1)}K`
  if (v >= 1_000) return v.toLocaleString("en-US")
  return String(v)
}

export function formatSeoSummaryLabel(summary: SeoSummary) {
  return {
    clicks: fmtCount(summary.totalClicks),
    impressions: fmtCount(summary.totalImpressions),
    ctr: `${summary.avgCtr.toFixed(1)}%`,
    position: summary.avgPosition.toFixed(1),
    queries: fmtCount(summary.rowCount),
  }
}
