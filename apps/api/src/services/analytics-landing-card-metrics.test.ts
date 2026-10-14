import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CARD_METRICS_LOOKBACK,
  emptyLandingPageCardMetrics,
} from './analytics-landing-card-metrics.js'

describe('landing page card metrics windows', () => {
  it('uses one shared lookback for visitors, submits, and bounce', () => {
    expect(CARD_METRICS_LOOKBACK).toBe('7 DAY')
  })

  it('keeps visitors7d on the empty payload so UI can surface it', () => {
    expect(emptyLandingPageCardMetrics()).toEqual({
      activeUsers: 0,
      visitors7d: 0,
      formSubmissions: 0,
      bounceRate: 0,
    })
  })

  it('bounds form submissions and bounce to the shared lookback in SQL', () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'analytics.service.ts'),
      'utf8',
    )
    expect(source).toContain('CARD_METRICS_LOOKBACK')
    expect(source).not.toContain('CARD_BOUNCE_LOOKBACK')
    expect(source).not.toContain('24 MONTH')
    // Form submits must not be an unbounded uniqExactIf(session_id, pred) only.
    expect(source).toMatch(
      /created_at >= now\(\) - INTERVAL \$\{CARD_METRICS_LOOKBACK\}\s+AND \(\$\{submissionPred\}\)/,
    )
  })
})
