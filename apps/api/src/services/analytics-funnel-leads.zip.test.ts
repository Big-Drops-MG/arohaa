import { describe, expect, it } from 'vitest'
import { funnelLeadSeedEventWhere } from './analytics-funnel-leads.service.js'
import {
  fieldsWithoutReserved,
  isDisplayableLead,
  normalizeLeadFields,
  pickLeadZip,
} from '../lib/lead-fields.js'

describe('funnel leads seeding', () => {
  it('requires field blobs and does not seed bare zip_submit', () => {
    const where = funnelLeadSeedEventWhere()
    expect(where).not.toContain("event_name = 'zip_submit'")
    expect(where).toContain('form_success')
    expect(where).toContain('"fields"')
    expect(where).toContain('"_k"')
    expect(where).not.toMatch(/zipcode\s*!=\s*''/)
  })

  it('still normalizes zip from field props when present', () => {
    const raw = { formId: 'default-form', zip: '90210', first_name: 'Ada' }
    const fields = normalizeLeadFields(raw)
    const zip = pickLeadZip(fields)
    const visible = fieldsWithoutReserved(fields)

    expect(zip).toBe('90210')
    expect(visible.first_name).toBe('Ada')
    expect(visible.formId).toBeUndefined()
    expect(isDisplayableLead({ zip, email: '', fields: visible })).toBe(true)
  })
})
