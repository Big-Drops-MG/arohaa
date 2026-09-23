import { describe, expect, it } from 'vitest'
import { validateEvent } from './validator.js'

const WID = '11111111-1111-4111-8111-111111111111'

function baseEvent(overrides: Record<string, unknown> = {}) {
  return {
    workspace_id: WID,
    event_name: 'page_view',
    user_id: 'user-abc-12345',
    session_id: 'sess-abc-12345',
    created_at: new Date().toISOString().replace('T', ' ').replace('Z', ''),
    ...overrides,
  }
}

describe('validateEvent', () => {
  it('accepts page_leave and form_field_abandon', () => {
    expect(validateEvent(baseEvent({ event_name: 'page_leave' }))).toBe(true)
    expect(
      validateEvent(baseEvent({ event_name: 'form_field_abandon' })),
    ).toBe(true)
  })

  it('rejects unknown event names', () => {
    expect(validateEvent(baseEvent({ event_name: 'drop_table' }))).toBe(false)
    expect(validateEvent(baseEvent({ event_name: 'CustomHack' }))).toBe(false)
  })

  it('rejects invalid workspace ids', () => {
    expect(validateEvent(baseEvent({ workspace_id: 'not-a-uuid' }))).toBe(
      false,
    )
  })
})
