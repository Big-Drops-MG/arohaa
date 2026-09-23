import { describe, expect, it } from 'vitest'
import { ingestBodyToEventRow } from '../types/event.js'
import { insertEvents } from './clickhouse.service.js'

const enrichment = {
  referrerSource: 'direct',
  browser: 'Chrome',
  os: 'Windows',
  device: 'desktop',
  country: 'US',
  city: 'Austin',
  state: 'Texas',
  zipcode: '78701',
  stateCode: 'TX',
  latitude: 30.27,
  longitude: -97.74,
  accuracyRadius: 50,
  tenantWorkspaceId: '22222222-2222-4222-8222-222222222222',
}

describe('ClickHouse event row shaping', () => {
  it('maps ingest body to events_raw columns including tenant_workspace_id', () => {
    const row = ingestBodyToEventRow(
      {
        event_id: 'evt-1',
        ev: 'page_leave',
        wid: '11111111-1111-4111-8111-111111111111',
        uid: 'user-1',
        sid: 'sess-1',
        lp_id: 'lp_public',
        url: 'https://example.com/landing?utm_source=x',
        props: { fieldName: 'email' },
      },
      'trace-1',
      enrichment,
    )

    expect(row.event_name).toBe('page_leave')
    expect(row.workspace_id).toBe('11111111-1111-4111-8111-111111111111')
    expect(row.tenant_workspace_id).toBe(enrichment.tenantWorkspaceId)
    expect(row.lp_public_id).toBe('lp_public')
    expect(row.trace_id).toBe('trace-1')
    expect(row.url).not.toContain('utm_source')
    expect(JSON.parse(row.properties)).toEqual({ fieldName: 'email' })
    expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)
  })

  it('insertEvents no-ops on empty batches', async () => {
    await expect(insertEvents([])).resolves.toBeUndefined()
  })
})
