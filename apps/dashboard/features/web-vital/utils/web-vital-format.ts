import type {
  WebVitalMetricSummary,
  WebVitalRating,
} from "@/features/web-vital/model/web-vital"

export function formatWebVitalValue(
  value: number | null | undefined,
  unit: "ms" | "unitless"
): string {
  const n = value == null || !Number.isFinite(value) ? 0 : value
  if (unit === "unitless") {
    return n < 0.01 && n > 0 ? n.toFixed(3) : n.toFixed(2)
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(n >= 10_000 ? 1 : 2)} s`
  }
  return `${Math.round(n)} ms`
}

export function formatWebVitalRating(rating: WebVitalRating): string {
  switch (rating) {
    case "good":
      return "Good"
    case "needs-improvement":
      return "Needs improvement"
    case "poor":
      return "Poor"
    default:
      return "No data"
  }
}

export function webVitalRatingClassName(rating: WebVitalRating): string {
  switch (rating) {
    case "good":
      return "border-emerald-200 bg-emerald-50 text-emerald-800"
    case "needs-improvement":
      return "border-amber-200 bg-amber-50 text-amber-800"
    case "poor":
      return "border-red-200 bg-red-50 text-red-800"
    default:
      return "border-neutral-200 bg-neutral-50 text-neutral-500"
  }
}

export function lighthouseScoreTone(
  score: number | null
): "good" | "average" | "poor" | "none" {
  if (score == null || score === 0) return "none"
  if (score >= 90) return "good"
  if (score >= 50) return "average"
  return "poor"
}

export function metricLabel(name: WebVitalMetricSummary["name"]): string {
  switch (name) {
    case "LCP":
      return "Largest Contentful Paint"
    case "FCP":
      return "First Contentful Paint"
    case "CLS":
      return "Cumulative Layout Shift"
    case "INP":
      return "Interaction to Next Paint"
  }
}

export function metricDescription(name: WebVitalMetricSummary["name"]): string {
  switch (name) {
    case "LCP":
      return "Loading"
    case "FCP":
      return "First paint"
    case "CLS":
      return "Stability"
    case "INP":
      return "Responsiveness"
  }
}
