import { describe, expect, it } from 'vitest'
import {
  computeLevel1StatsFromLeads,
  computeLevel2StatsFromLeads,
  computeLevel3FromLeads,
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

  it('picks the Zip with the most form submissions and includes sample context', () => {
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
    expect(stats[1]?.sampleSize).toBe(3)
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
      { label: 'Submitted', value: 2 },
      { label: 'Not submitted', value: 3 },
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
      { label: 'Submitted', value: 60 },
      { label: 'Not submitted', value: 40 },
    ])
  })

  it('picks best age group, city, and state by conversion efficiency', () => {
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
        fields: { dob: '01/15/1990', city: 'Austin', state: 'TX' },
      }),
      lead({
        createdAt: '2026-01-04T19:30:00Z',
        formSubmitted: true,
        fields: { dob: '06/20/1988', city: 'Austin', state: 'TX' },
      }),
      lead({
        createdAt: '2026-01-05T19:30:00Z',
        formSubmitted: false,
        fields: { dob: '03/10/2005', city: 'Dallas', state: 'CA' },
      }),
      lead({
        createdAt: '2026-01-06T19:30:00Z',
        formSubmitted: false,
        fields: { dob: '03/10/2005', city: 'Dallas', state: 'CA' },
      }),
      lead({
        createdAt: '2026-01-07T19:30:00Z',
        formSubmitted: true,
        fields: { dob: '03/10/2005', city: 'Dallas', state: 'CA' },
      }),
    ])

    expect(stats[3]?.id).toBe('best-age-group')
    expect(stats[3]?.value).toBe('35-44')
    expect(stats[3]?.metricValue).toBe(4)
    expect(stats[3]?.sampleSize).toBe(4)

    expect(stats[4]?.id).toBe('best-city')
    expect(stats[4]?.value).toBe('Austin')
    expect(stats[4]?.metricValue).toBe(4)
    expect(stats[4]?.sampleSize).toBe(4)

    expect(stats[5]?.id).toBe('best-state')
    expect(stats[5]?.value).toBe('Texas')
    expect(stats[5]?.metricValue).toBe(4)
  })

  it('ranks best time by Wilson efficiency, not raw submission volume', () => {
    const stats = computeLevel1StatsFromLeads([
      // Peak hour with high volume but weaker rate (5/10)
      ...Array.from({ length: 5 }, () =>
        lead({ createdAt: '2026-01-01T19:30:00Z', formSubmitted: true }),
      ),
      ...Array.from({ length: 5 }, () =>
        lead({ createdAt: '2026-01-01T19:45:00Z', formSubmitted: false }),
      ),
      // Off-peak hour with strong rate (8/9)
      ...Array.from({ length: 8 }, () =>
        lead({ createdAt: '2026-01-02T14:00:00Z', formSubmitted: true }),
      ),
      lead({ createdAt: '2026-01-02T14:15:00Z', formSubmitted: false }),
    ])

    expect(stats[0]?.enoughData).toBe(true)
    expect(stats[0]?.metricValue).toBe(8)
    expect(stats[0]?.sampleSize).toBe(9)
    expect(stats[0]?.submissionRate).toBeTruthy()
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

describe('computeLevel3FromLeads', () => {
  it('picks conversion-efficiency winners from supported dimensions and pairs', () => {
    const leads = [
      ...Array.from({ length: 8 }, (_, index) =>
        lead({
          createdAt: `2026-01-01T1${index % 4}:30:00Z`,
          formSubmitted: index < 6,
          fields: {
            state: 'TX',
            dob: '01/15/1990',
            car_0_make: 'BUI',
          },
          zip: '73301',
        }),
      ).map((row) => ({
        ...row,
        utmSource: 'google',
      })),
      ...Array.from({ length: 8 }, (_, index) =>
        lead({
          createdAt: `2026-01-02T0${index % 4}:30:00Z`,
          formSubmitted: index < 2,
          fields: {
            state: 'CA',
            dob: '03/10/2005',
            car_0_make: 'CHE',
          },
          zip: '90001',
        }),
      ).map((row) => ({
        ...row,
        utmSource: 'facebook',
      })),
    ]

    const level3 = computeLevel3FromLeads(leads, ['state', 'dob', 'car_0_make'])
    const byId = new Map(level3.winners.map((winner) => [winner.id, winner]))

    expect(byId.get('best-converting-source')?.value).toBe('google')
    expect(byId.get('best-converting-state')?.value).toBe('Texas')
    expect(byId.get('best-converting-age-group')?.value).toBe('35-44')
    expect(byId.get('best-converting-source-age-group')?.value).toBe(
      'google x 35-44',
    )
    expect(byId.get('best-converting-source-state')?.value).toBe(
      'google x Texas',
    )
    expect(byId.get('best-converting-source-make')?.value).toBe('google x Buick')
    expect(byId.get('best-converting-source-time')?.value).toContain('google x ')
    expect(byId.get('best-converting-age-state')?.value).toBe('35-44 x Texas')
    expect(byId.get('best-converting-vehicle-make')?.value).toBe('Buick')
    expect(level3.boards.map((board) => board.id)).toEqual([
      'source-performance',
      'state-performance',
      'source-age-performance',
      'source-state-performance',
      'source-make-performance',
      'source-time-performance',
      'age-state-performance',
      'make-age-performance',
      'make-state-performance',
      'time-state-performance',
      'time-age-performance',
    ])
  })

  it('hides unsupported dimension insights when those lead columns are not visible', () => {
    const level3 = computeLevel3FromLeads(
      [
        { ...lead({ createdAt: '2026-01-01T12:00:00Z', formSubmitted: true }), utmSource: 'google' },
        { ...lead({ createdAt: '2026-01-01T13:00:00Z', formSubmitted: false }), utmSource: 'google' },
      ],
      [],
    )

    const winnerIds = level3.winners.map((winner) => winner.id)
    expect(winnerIds).toContain('best-converting-source')
    expect(winnerIds).toContain('most-efficient-time-window')
    expect(winnerIds).toContain('best-converting-source-time')
    expect(winnerIds).not.toContain('best-converting-state')
    expect(winnerIds).not.toContain('best-converting-age-group')
    expect(winnerIds).not.toContain('best-converting-source-age-group')
    expect(winnerIds).not.toContain('best-converting-source-make')
    expect(winnerIds).not.toContain('best-converting-source-gender')
    expect(winnerIds).not.toContain('best-converting-vehicle-make')
    expect(level3.boards.map((board) => board.id)).toEqual([
      'source-performance',
      'source-time-performance',
    ])
  })

  it('adds Source x Gender and Age x State when those columns are visible', () => {
    const leads = [
      ...Array.from({ length: 8 }, (_, index) => ({
        ...lead({
          createdAt: '2026-01-01T12:00:00Z',
          formSubmitted: index < 7,
          fields: {
            state: 'TX',
            dob: '01/15/1990',
            driver_0_gender: 'male',
            car_0_make: 'TOY',
          },
        }),
        utmSource: 'google',
      })),
      ...Array.from({ length: 8 }, (_, index) => ({
        ...lead({
          createdAt: '2026-01-01T18:00:00Z',
          formSubmitted: index < 2,
          fields: {
            state: 'CA',
            dob: '03/10/2005',
            driver_0_gender: 'female',
            car_0_make: 'CHE',
          },
        }),
        utmSource: 'facebook',
      })),
    ]

    const level3 = computeLevel3FromLeads(leads, [
      'state',
      'dob',
      'driver_0_gender',
      'car_0_make',
    ])
    const winnerIds = level3.winners.map((winner) => winner.id)
    const boardIds = level3.boards.map((board) => board.id)

    expect(winnerIds).toContain('best-converting-source-gender')
    expect(winnerIds).toContain('best-converting-age-state')
    expect(winnerIds).toContain('best-converting-make-age')
    expect(boardIds).toContain('source-gender-performance')
    expect(boardIds).toContain('age-state-performance')
    expect(boardIds).toContain('make-age-performance')

    const sourceGender = level3.winners.find(
      (winner) => winner.id === 'best-converting-source-gender',
    )
    expect(sourceGender?.value).toBe('google x Male')

    const pairBoardCount = boardIds.filter(
      (id) => id !== 'source-performance' && id !== 'state-performance',
    ).length
    expect(pairBoardCount).toBeLessThanOrEqual(10)
  })

  it('ranks Source x Make by Wilson among mid-size samples, not weak large buckets', () => {
    const toyota559 = Array.from({ length: 8 }, (_, index) => ({
      ...lead({
        createdAt: '2026-01-01T12:00:00Z',
        formSubmitted: index < 3,
        fields: { car_0_make: 'TOY' },
      }),
      utmSource: '559',
    }))
    const ford559 = Array.from({ length: 6 }, (_, index) => ({
      ...lead({
        createdAt: '2026-01-01T13:00:00Z',
        formSubmitted: index < 5,
        fields: { car_0_make: 'FOR' },
      }),
      utmSource: '559',
    }))
    const jeep1239 = Array.from({ length: 5 }, () => ({
      ...lead({
        createdAt: '2026-01-01T14:00:00Z',
        formSubmitted: true,
        fields: { car_0_make: 'JEE' },
      }),
      utmSource: '1239',
    }))

    const level3 = computeLevel3FromLeads(
      [...toyota559, ...ford559, ...jeep1239],
      ['car_0_make'],
    )
    const board = level3.boards.find((item) => item.id === 'source-make-performance')
    const winner = level3.winners.find(
      (item) => item.id === 'best-converting-source-make',
    )

    expect(board?.rows[0]?.label).toBe('559 x Ford')
    expect(board?.takeaway).toContain('559 x Ford')
    expect(winner?.value).toBe('559 x Ford')
    expect(board?.rows.map((row) => row.label).slice(0, 3)).toEqual([
      '559 x Ford',
      '559 x Toyota',
      '1239 x Jeep',
    ])
  })

  it('ranks board rows with the same min-sample rule as takeaways', () => {
    const georgia = Array.from({ length: 3 }, () => ({
      ...lead({
        createdAt: '2026-01-01T12:00:00Z',
        formSubmitted: true,
        fields: { state: 'GA' },
      }),
      utmSource: '1239',
    }))
    const california = Array.from({ length: 8 }, (_, index) => ({
      ...lead({
        createdAt: '2026-01-01T13:00:00Z',
        formSubmitted: index < 6,
        fields: { state: 'CA' },
      }),
      utmSource: '559',
    }))
    const maine = Array.from({ length: 2 }, () => ({
      ...lead({
        createdAt: '2026-01-01T14:00:00Z',
        formSubmitted: true,
        fields: { state: 'ME' },
      }),
      utmSource: '1239',
    }))

    const level3 = computeLevel3FromLeads(
      [...georgia, ...california, ...maine],
      ['state'],
    )
    const stateBoard = level3.boards.find((board) => board.id === 'state-performance')
    const sourceStateBoard = level3.boards.find(
      (board) => board.id === 'source-state-performance',
    )
    const bestState = level3.winners.find(
      (winner) => winner.id === 'best-converting-state',
    )
    const bestSourceState = level3.winners.find(
      (winner) => winner.id === 'best-converting-source-state',
    )

    expect(stateBoard?.rows[0]?.label).toBe('California')
    expect(stateBoard?.takeaway).toContain('California')
    expect(bestState?.value).toBe('California')

    expect(sourceStateBoard?.rows[0]?.label).toBe('559 x California')
    expect(sourceStateBoard?.takeaway).toContain('559 x California')
    expect(bestSourceState?.value).toBe('559 x California')
  })

  it('flags when the volume leader differs from the efficiency leader', () => {
    const google = Array.from({ length: 20 }, (_, index) => ({
      ...lead({
        createdAt: '2026-01-01T12:00:00Z',
        formSubmitted: index < 7,
      }),
      utmSource: 'google',
    }))
    const facebook = Array.from({ length: 8 }, (_, index) => ({
      ...lead({
        createdAt: '2026-01-01T13:00:00Z',
        formSubmitted: index < 6,
      }),
      utmSource: 'facebook',
    }))

    const gap = computeLevel3FromLeads([...google, ...facebook], []).winners.find(
      (winner) => winner.id === 'volume-vs-efficiency-gap',
    )

    expect(gap?.value).toBe('google vs facebook')
    expect(gap?.metricLabel).toBe('Gap (pp)')
    expect(gap?.metricValue).toBe(40)
  })
})
