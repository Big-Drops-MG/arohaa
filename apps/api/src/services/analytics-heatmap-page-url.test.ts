import { describe, expect, it } from 'vitest'
import { resolveAnalyticsHeatmapPageUrl } from './analytics-heatmap.service.js'

describe('resolveAnalyticsHeatmapPageUrl', () => {
  it('returns earliest page when nothing is requested', () => {
    expect(
      resolveAnalyticsHeatmapPageUrl(null, [
        'https://example.com/privacy',
        'https://example.com/',
      ]),
    ).toBe('https://example.com/privacy')
  })

  it('keeps an exact requested match', () => {
    expect(
      resolveAnalyticsHeatmapPageUrl('https://example.com/', [
        'https://example.com/privacy',
        'https://example.com/',
      ]),
    ).toBe('https://example.com/')
  })

  it('matches the same path without hash when landing URL is requested', () => {
    expect(
      resolveAnalyticsHeatmapPageUrl('https://example.com/', [
        'https://example.com/#/zip',
        'https://example.com/',
        'https://example.com/privacy',
      ]),
    ).toBe('https://example.com/')
  })

  it('uses the requested landing URL even with no ClickHouse rows yet', () => {
    expect(
      resolveAnalyticsHeatmapPageUrl('https://example.com/', [
        'https://example.com/privacy',
      ]),
    ).toBe('https://example.com/')
  })
})
