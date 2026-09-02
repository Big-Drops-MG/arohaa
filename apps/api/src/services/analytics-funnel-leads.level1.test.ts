import { describe, expect, it } from 'vitest'
import {
  computeLevel1StatsFromLeads,
  computeLevel2StatsFromLeads,
  type FunnelLeadRow,
} from './analytics-funnel-leads.service.js'

function lead({
  createdAt,
  formSubmitted,
  submittedAt = null,
  zip = '90210',
  fields = {},
}: {
  createdAt: string
  formSubmitted: boolean
  submittedAt?: string | null
  zip?: string
  fields?: Record<string, string>
}): FunnelLeadRow {
  return {
    sessionId: 's1',
    macId: '',
    createdAt,
    submittedAt,
    zip,
    email: 'a@example.com',
    utmSource: '',
    utmId: '',
    trustedFormUrl: '',
    formSubmitted,
    fields,
  }
}

describe('computeLevel1StatsFromLeads', () => {
  it('returns empty best stats when no submitted leads', () => {
    const stats = computeLevel1StatsFromLeads([
      lead({ createdAt: '2026-01-01T14:00:00Z', formSubmitted: false }),
    ])
    expect(stats).toHaveLength(6)
    expect(stats[0]?.id).toBe('best-time')
    expect(stats[0]?.enoughData).toBe(false)
    expect(stats[0]?.metricValue).toBe(0)
    expect(stats[1]?.id).toBe('best-zip')
    expect(stats[1]?.enoughData).toBe(false)
    expect(stats[1]?.metricValue).toBe(0)
    expect(stats[3]?.id).toBe('best-age-group')
    expect(stats[3]?.enoughData).toBe(false)
    expect(stats[4]?.id).toBe('best-city')
    expect(stats[5]?.id).toBe('best-state')
  })

  it('uses When column createdAt, not submittedAt', () => {
    const stats = computeLevel1StatsFromLeads([
      lead({
        createdAt: '2026-01-01T19:30:00Z',
        formSubmitted: true,
        submittedAt: '2026-01-01T09:00:00Z',
      }),
      lead({
        createdAt: '2026-01-02T19:45:00Z',
        formSubmitted: true,
        submittedAt: '2026-01-02T09:00:00Z',
      }),
      lead({
        createdAt: '2026-01-03T14:00:00Z',
        formSubmitted: true,
        submittedAt: '2026-01-03T19:00:00Z',
      }),
    ])
    expect(stats[0]?.enoughData).toBe(true)
    expect(stats[0]?.metricValue).toBe(2)
    expect(stats[0]?.value).toMatch(/ET/)
  })

  it('parses ClickHouse space-separated timestamps like the When column', () => {
    const stats = computeLevel1StatsFromLeads([
      lead({ createdAt: '2026-01-01 19:30:00', formSubmitted: true }),
      lead({ createdAt: '2026-01-02 19:45:00', formSubmitted: true }),
    ])
    expect(stats[0]?.enoughData).toBe(true)
    expect(stats[0]?.metricValue).toBe(2)
  })

  it('picks the Zip with the most form submissions', () => {
    const stats = computeLevel1StatsFromLeads([
      lead({
        createdAt: '2026-01-01T19:30:00Z',
        formSubmitted: true,
        zip: '10001',
      }),
      lead({
        createdAt: '2026-01-02T19:45:00Z',
        formSubmitted: true,
        zip: '90210',
      }),
      lead({
        createdAt: '2026-01-03T14:00:00Z',
        formSubmitted: true,
        zip: '90210',
      }),
      lead({
        createdAt: '2026-01-04T14:00:00Z',
        formSubmitted: false,
        zip: '90210',
      }),
      lead({
        createdAt: '2026-01-05T14:00:00Z',
        formSubmitted: true,
        zip: '',
      }),
    ])
    expect(stats[1]?.id).toBe('best-zip')
    expect(stats[1]?.enoughData).toBe(true)
    expect(stats[1]?.value).toBe('90210')
    expect(stats[1]?.metricValue).toBe(2)
  })

  it('counts Yes and No form submission totals across all leads', () => {
    const stats = computeLevel1StatsFromLeads([
      lead({ createdAt: '2026-01-01T19:30:00Z', formSubmitted: true }),
      lead({ createdAt: '2026-01-02T19:45:00Z', formSubmitted: true }),
      lead({ createdAt: '2026-01-03T14:00:00Z', formSubmitted: false }),
      lead({ createdAt: '2026-01-04T14:00:00Z', formSubmitted: false }),
      lead({ createdAt: '2026-01-05T14:00:00Z', formSubmitted: false }),
    ])
    const ratio = stats[2]
    expect(ratio?.id).toBe('form-submission-ratio')
    expect(ratio?.enoughData).toBe(true)
    expect(ratio?.value).toBe('40% : 60%')
    expect(ratio?.breakdown).toEqual([
      { label: 'Yes', value: 2 },
      { label: 'No', value: 3 },
    ])
  })

  it('shows Yes:No as percent of total leads', () => {
    const stats = computeLevel1StatsFromLeads([
      ...Array.from({ length: 60 }, (_, i) =>
        lead({
          createdAt: `2026-01-01T${String(10 + (i % 10)).padStart(2, '0')}:00:00Z`,
          formSubmitted: true,
        }),
      ),
      ...Array.from({ length: 40 }, (_, i) =>
        lead({
          createdAt: `2026-01-02T${String(10 + (i % 10)).padStart(2, '0')}:00:00Z`,
          formSubmitted: false,
        }),
      ),
    ])
    const ratio = stats[2]
    expect(ratio?.value).toBe('60% : 40%')
    expect(ratio?.breakdown).toEqual([
      { label: 'Yes', value: 60 },
      { label: 'No', value: 40 },
    ])
  })

  it('picks best age group, city, and state from submitted lead fields', () => {
    const stats = computeLevel1StatsFromLeads([
      lead({
        createdAt: '2026-01-01T19:30:00Z',
        formSubmitted: true,
        fields: { dob: '01/15/1990', city: 'Austin', state: 'TX' },
      }),
      lead({
        createdAt: '2026-01-02T19:30:00Z',
        formSubmitted: true,
        fields: { dob: '06/20/1988', city: 'Austin', state: 'TX' },
      }),
      lead({
        createdAt: '2026-01-03T19:30:00Z',
        formSubmitted: true,
        fields: { dob: '03/10/2005', city: 'Dallas', state: 'CA' },
      }),
      lead({
        createdAt: '2026-01-04T19:30:00Z',
        formSubmitted: false,
        fields: { dob: '01/15/1990', city: 'Austin', state: 'TX' },
      }),
    ])

    expect(stats[3]?.id).toBe('best-age-group')
    expect(stats[3]?.value).toBe('35-44')
    expect(stats[3]?.metricValue).toBe(2)

    expect(stats[4]?.id).toBe('best-city')
    expect(stats[4]?.value).toBe('Austin')
    expect(stats[4]?.metricValue).toBe(2)

    expect(stats[5]?.id).toBe('best-state')
    expect(stats[5]?.value).toBe('Texas')
    expect(stats[5]?.metricValue).toBe(2)
  })
})

describe('computeLevel2StatsFromLeads', () => {
  it('builds dynamic Best cards from remaining leads columns', () => {
    const stats = computeLevel2StatsFromLeads([
      lead({
        createdAt: '2026-01-01T19:30:00Z',
        formSubmitted: true,
        zip: '90210',
        fields: {
          dob: '01/15/1990',
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@example.com',
          city: 'Austin',
          state: 'TX',
          driver_0_gender: 'female',
          unit: '4B',
        },
      }),
      lead({
        createdAt: '2026-01-02T19:30:00Z',
        formSubmitted: true,
        zip: '90210',
        fields: {
          city: 'Austin',
          state: 'TX',
          driver_0_gender: 'female',
        },
      }),
      lead({
        createdAt: '2026-01-03T19:30:00Z',
        formSubmitted: true,
        zip: '10001',
        fields: {
          city: 'Dallas',
          state: 'CA',
          driver_0_gender: 'male',
        },
      }),
    ])

    const ids = stats.map((stat) => stat.id)
    expect(ids).toContain('best-driver-0-gender')
    expect(ids).not.toContain('best-zip')
    expect(ids).not.toContain('best-city')
    expect(ids).not.toContain('best-state')
    expect(ids).not.toContain('best-dob')
    expect(ids).not.toContain('best-first-name')
    expect(ids).not.toContain('best-last-name')
    expect(ids).not.toContain('best-unit')
    expect(ids).not.toContain('best-email')

    const genderRatio = stats.find(
      (stat) => stat.id === 'best-driver-0-gender',
    )
    expect(genderRatio?.label).toBe(
      'Driver 0 Gender Ratio (Male : Female)',
    )
    expect(genderRatio?.value).toBe('33.3% : 66.7%')
    expect(genderRatio?.breakdown).toEqual([
      { label: 'Male', value: 1 },
      { label: 'Female', value: 2 },
    ])
  })

  it('only uses visible leads field columns (minus Level 1 / fixed / PII)', () => {
    const stats = computeLevel2StatsFromLeads([
      lead({
        createdAt: '2026-01-01T19:30:00Z',
        formSubmitted: true,
        zip: '90210',
        fields: {
          city: 'Austin',
          state: 'TX',
          language: 'es',
          driver_0_gender: 'female',
          car_0_make: 'Toyota',
        },
      }),
    ])

    const ids = stats.map((stat) => stat.id)
    expect(ids).toEqual(['best-car-0-make', 'best-driver-0-gender'])
  })

  it('shows full make names and Yes:No ratios', () => {
    const stats = computeLevel2StatsFromLeads([
      lead({
        createdAt: '2026-01-01T19:30:00Z',
        formSubmitted: true,
        fields: { car_0_make: 'BUI', driver_0_married: 'Yes' },
      }),
      lead({
        createdAt: '2026-01-02T19:30:00Z',
        formSubmitted: true,
        fields: { car_0_make: 'BUI', driver_0_married: 'No' },
      }),
      lead({
        createdAt: '2026-01-03T19:30:00Z',
        formSubmitted: true,
        fields: { car_0_make: 'CHE', driver_0_married: 'No' },
      }),
    ])

    const make = stats.find((stat) => stat.id === 'best-car-0-make')
    expect(make?.value).toBe('Buick')

    const married = stats.find(
      (stat) => stat.id === 'best-driver-0-married',
    )
    expect(married?.label).toBe(
      'Driver 0 Married Ratio (Yes : No)',
    )
    expect(married?.value).toBe('33.3% : 66.7%')
    expect(married?.breakdown).toEqual([
      { label: 'Yes', value: 1 },
      { label: 'No', value: 2 },
    ])
  })
})
