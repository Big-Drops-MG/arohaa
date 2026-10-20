import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { emptyLandingPageCardMetrics } from './analytics-landing-card-metrics.js'

describe('landing page card metrics windows', () => {
  it('keeps visitors on the empty payload so UI can surface all-time totals', () => {
    expect(emptyLandingPageCardMetrics()).toEqual({
      activeUsers: 0,
      visitors: 0,
      formSubmissions: 0,
      bounceRate: 0,
    })
  })

  it('counts visitors and form submits all-time (only Active Now is live)', () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'analytics.service.ts'),
      'utf8',
    )
    const cardQueryStart = source.indexOf('async function queryLandingPageCardMetrics')
    expect(cardQueryStart).toBeGreaterThan(-1)
    const cardQuery = source.slice(cardQueryStart, cardQueryStart + 2500)
    expect(cardQuery).toContain(
      "uniqExactIf(user_id, event_name = 'page_view') AS visitors",
    )
    expect(cardQuery).toContain(
      'uniqExactIf(session_id, (${submissionPred})) AS form_submissions',
    )
    expect(cardQuery).toContain('INTERVAL 5 MINUTE')
    expect(cardQuery).not.toContain('CARD_METRICS_LOOKBACK')
    expect(cardQuery).not.toContain('visitors_7d')
  })
})
