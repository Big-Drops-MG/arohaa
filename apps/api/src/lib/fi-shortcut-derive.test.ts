import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { encryptJsonBlob } from './field-blob.js'
import { buildShortcutRowsFromFi } from './fi-shortcut-derive.js'
import type { EventRow } from '../types/event.js'

const prevKey = process.env.AROHAA_FIELD_BLOB_KEY
const prevSecret = process.env.AROHAA_INTERNAL_API_SECRET

beforeEach(() => {
  process.env.AROHAA_FIELD_BLOB_KEY = Buffer.alloc(32, 7).toString('base64')
  delete process.env.AROHAA_INTERNAL_API_SECRET
})

afterEach(() => {
  if (prevKey === undefined) delete process.env.AROHAA_FIELD_BLOB_KEY
  else process.env.AROHAA_FIELD_BLOB_KEY = prevKey
  if (prevSecret === undefined) delete process.env.AROHAA_INTERNAL_API_SECRET
  else process.env.AROHAA_INTERNAL_API_SECRET = prevSecret
})

function baseRow(overrides: Partial<EventRow> = {}): EventRow {
  return {
    event_id: '11111111-1111-4111-8111-111111111111',
    event_name: '_fi',
    workspace_id: '22222222-2222-4222-8222-222222222222',
    tenant_workspace_id: '',
    lp_public_id: '',
    user_id: 'u1',
    session_id: 's1',
    fingerprint: '',
    url: '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_term: '',
    utm_content: '',
    utm_id: '',
    utm_s1: '',
    referrer: '',
    referrer_source: '',
    browser: '',
    os: '',
    device: '',
    country: '',
    country_code: '',
    city: '',
    state: '',
    zipcode: '',
    geo_zipcode: '',
    form_zip_entered: '',
    client_ip: '',
    client_ip_hash: '',
    phone_hash: '',
    email_hash: '',
    state_code: '',
    latitude: 0,
    longitude: 0,
    geo_accuracy: 0,
    network_class: '',
    network_asn: 0,
    network_org: '',
    network_evidence_source: '',
    network_evidence_as_of: '',
    variant: '',
    formtype: '',
    metric_name: '',
    metric_value: 0,
    properties: '{}',
    trace_id: 't1',
    created_at: '2026-01-01 00:00:00.000',
    ...overrides,
  }
}

describe('buildShortcutRowsFromFi', () => {
  it('emits paste shortcut from Control+v FI payload', () => {
    const blob = encryptJsonBlob({
      v: 1,
      i: [{ t: 1, k: 1, m: "pressed 'Control+v' in [email]" }],
    })
    expect(blob).toBeTruthy()
    const rows = buildShortcutRowsFromFi(
      baseRow({ properties: JSON.stringify({ _k: blob }) }),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.event_name).toBe('form_shortcut_paste')
    expect(rows[0]?.event_id).not.toBe(baseRow().event_id)
  })

  it('returns empty when FI has no clipboard messages', () => {
    const blob = encryptJsonBlob({
      v: 1,
      i: [{ t: 1, k: 1, m: "typed 'a' in [email]" }],
    })
    const rows = buildShortcutRowsFromFi(
      baseRow({ properties: JSON.stringify({ _k: blob }) }),
    )
    expect(rows).toEqual([])
  })
})
