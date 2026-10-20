/**
 * Collection-card traffic metrics: Active Now is live (5m).
 * Visitors and form/zip submits are all-time totals.
 */
export interface LandingPageCardMetrics {
  activeUsers: number
  visitors: number
  formSubmissions: number
  bounceRate: number
}

export function emptyLandingPageCardMetrics(): LandingPageCardMetrics {
  return {
    activeUsers: 0,
    visitors: 0,
    formSubmissions: 0,
    bounceRate: 0,
  }
}
