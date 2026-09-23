import { describe, expect, it } from 'vitest'
import { widMatchesLandingPage } from '../services/landing-page-ingest.js'

describe('widMatchesLandingPage', () => {
  const landing = {
    id: '11111111-1111-4111-8111-111111111111',
    workspaceId: '22222222-2222-4222-8222-222222222222',
  }

  it('accepts landing-page UUID (data-wid product convention)', () => {
    expect(widMatchesLandingPage(landing.id, landing)).toBe(true)
  })

  it('accepts tenant workspace UUID when lp_id resolved the page', () => {
    expect(widMatchesLandingPage(landing.workspaceId, landing)).toBe(true)
  })

  it('rejects unrelated UUIDs', () => {
    expect(
      widMatchesLandingPage('33333333-3333-4333-8333-333333333333', landing),
    ).toBe(false)
  })

  it('allows empty wid when landing was resolved via lp_id', () => {
    expect(widMatchesLandingPage('', landing)).toBe(true)
  })
})
