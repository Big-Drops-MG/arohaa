import { describe, expect, it } from 'vitest'
import {
  propertiesJsonSafeForThirdParty,
  propsSafeForThirdParty,
} from './lead-outbound-guard.js'

describe('lead outbound guard', () => {
  it('strips opaque blob and decrypted fields', () => {
    expect(
      propsSafeForThirdParty({
        _k: 'cipher',
        fields: { email: 'a@b.com', phone: '555' },
        stepIndex: 2,
        leadId: 'lp-1',
        phone: '555',
      }),
    ).toEqual({ stepIndex: 2, leadId: 'lp-1' })
  })

  it('sanitizes properties JSON', () => {
    expect(
      propertiesJsonSafeForThirdParty(
        JSON.stringify({ fields: { name: 'x' }, status: 'accepted', cost: 12 }),
      ),
    ).toBe(JSON.stringify({ status: 'accepted', cost: 12 }))
  })
})
