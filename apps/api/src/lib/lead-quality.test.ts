import { describe, expect, it } from 'vitest'
import {
  computeLeadQualityByUtmSource,
  leadMatchesQualityAttribute,
} from './lead-quality.js'

describe('leadMatchesQualityAttribute', () => {
  it('matches homeowner and multi-vehicle fields', () => {
    const lead = {
      utmSource: '559',
      fields: {
        driver_0_homeowner: 'Own',
        car_0_make: 'Honda',
        car_1_make: 'Toyota',
      },
    }
    expect(leadMatchesQualityAttribute(lead, 'homeowner')).toBe(true)
    expect(leadMatchesQualityAttribute(lead, 'multiVehicle')).toBe(true)
  })
})

describe('computeLeadQualityByUtmSource', () => {
  it('aggregates rates per utm source across the full lead set', () => {
    const rows = computeLeadQualityByUtmSource([
      {
        utmSource: '559',
        fields: { driver_0_homeowner: 'Own', currently_insured: 'No' },
      },
      {
        utmSource: '559',
        fields: { driver_0_homeowner: 'Rent', currently_insured: 'Yes' },
      },
      {
        utmSource: '',
        fields: { driver_0_married: 'Married' },
      },
    ])

    expect(rows).toHaveLength(2)
    expect(rows[0]?.utmSource).toBe('559')
    expect(rows[0]?.totalLeads).toBe(2)
    expect(rows[0]?.rates.homeowner).toBe(0.5)
    expect(rows[0]?.rates.currentlyInsured).toBe(0.5)
    expect(rows[1]?.utmSource).toBe('(none)')
    expect(rows[1]?.rates.married).toBe(1)
  })
})
