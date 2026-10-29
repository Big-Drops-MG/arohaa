import { describe, expect, it } from 'vitest'
import { funnelLeadSeedEventWhere } from './analytics-funnel-leads.service.js'
import {
  fieldsWithoutReserved,
  isDisplayableLead,
  normalizeLeadFields,
  pickLeadZip,
} from '../lib/lead-fields.js'

describe('funnel leads zip conversion seeding', () => {
  it('includes zip_submit sessions without requiring fields/_k blobs', () => {
    const where = funnelLeadSeedEventWhere()
    expect(where).toContain("event_name = 'zip_submit'")
    expect(where).toContain('"fields"')
    expect(where).toContain('"zip"')
  })

  it('treats zip_submit props as a displayable lead', () => {
    const raw = { formId: 'default-form', zip: '90210' }
    const fields = normalizeLeadFields(raw)
    const zip = pickLeadZip(fields)
    const visible = fieldsWithoutReserved(fields)

    expect(zip).toBe('90210')
    expect(visible.formId).toBeUndefined()
    expect(visible.formid).toBeUndefined()
    expect(isDisplayableLead({ zip, fields: visible })).toBe(true)
  })
})
