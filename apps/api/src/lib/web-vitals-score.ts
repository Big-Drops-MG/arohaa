import type {
  WebVitalName,
  WebVitalRating,
} from '../types/analytics-web-vitals.js'

/** Core Web Vitals thresholds (web.dev / Chrome UX Report). */
const THRESHOLDS: Record<
  WebVitalName,
  { good: number; poor: number }
> = {
  LCP: { good: 2500, poor: 4000 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
}

/** Weights approximating Lighthouse Performance when only CWV are available. */
const SCORE_WEIGHTS: Record<WebVitalName, number> = {
  LCP: 0.4,
  INP: 0.3,
  CLS: 0.3,
}

export function rateWebVital(
  name: WebVitalName,
  value: number | null | undefined,
): WebVitalRating {
  if (value == null || !Number.isFinite(value) || value < 0) return 'none'
  const { good, poor } = THRESHOLDS[name]
  if (value <= good) return 'good'
  if (value <= poor) return 'needs-improvement'
  return 'poor'
}

/**
 * Map a metric value to a 0–100 score using CWV good/poor anchors
 * (≈90 at good, ≈50 at poor — same anchors Lighthouse uses).
 */
export function scoreWebVital(
  name: WebVitalName,
  value: number | null | undefined,
): number {
  if (value == null || !Number.isFinite(value) || value < 0) return 0
  const { good, poor } = THRESHOLDS[name]

  if (value <= 0) return 100
  if (value <= good) {
    const t = value / good
    return Math.round(100 - t * 10)
  }
  if (value >= poor) {
    const excess = (value - poor) / Math.max(poor, Number.EPSILON)
    return Math.max(0, Math.round(49 / (1 + excess * 1.5)))
  }
  const t = (value - good) / (poor - good)
  return Math.round(90 - t * 40)
}

export function compositeLighthouseScore(parts: {
  LCP?: number | null
  CLS?: number | null
  INP?: number | null
}): number | null {
  let weighted = 0
  let totalWeight = 0

  for (const name of ['LCP', 'INP', 'CLS'] as const) {
    const raw = parts[name]
    if (raw == null || !Number.isFinite(raw) || raw < 0) continue
    const weight = SCORE_WEIGHTS[name]
    weighted += scoreWebVital(name, raw) * weight
    totalWeight += weight
  }

  if (totalWeight <= 0) return null
  return Math.round(weighted / totalWeight)
}

export function webVitalUnit(name: WebVitalName): 'ms' | 'unitless' {
  return name === 'CLS' ? 'unitless' : 'ms'
}
