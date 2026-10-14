/**
 * Collection-card traffic metrics share one lookback so Active Now (5m) is the
 * only live exception. Visitors, form submits, and bounce all use this window.
 */
export const CARD_METRICS_LOOKBACK = '7 DAY'

export interface LandingPageCardMetrics {
  activeUsers: number
  visitors7d: number
  formSubmissions: number
  bounceRate: number
}

export function emptyLandingPageCardMetrics(): LandingPageCardMetrics {
  return {
    activeUsers: 0,
    visitors7d: 0,
    formSubmissions: 0,
    bounceRate: 0,
  }
}
