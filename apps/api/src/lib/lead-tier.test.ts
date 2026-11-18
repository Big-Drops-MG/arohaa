import { beforeAll, describe, expect, it } from 'vitest'
import { encryptFieldBlob, OPAQUE_PROP_KEY } from './field-blob.js'
import {
  classifyLeadTier,
  leadTierForIngestEvent,
  resolveLeadTier,
} from './lead-tier.js'

beforeAll(() => {
  process.env.AROHAA_FIELD_BLOB_KEY = 'lead-tier-test-key'
})

describe('classifyLeadTier', () => {
  it('is premium only when homeowner, insured and 2+ vehicles all match', () => {
    expect(
      classifyLeadTier({
        driver_0_homeowner: 'Own',
        currently_insured: 'Yes',
        car_0_make: 'Honda',
        car_1_make: 'Toyota',
      }),
    ).toBe('premium')
  })

  it('is standard when any premium criterion is missing', () => {
    expect(
      classifyLeadTier({
        driver_0_homeowner: 'Own',
        currently_insured: 'Yes',
        car_0_make: 'Honda',
      }),
    ).toBe('standard')
    expect(
      classifyLeadTier({
        driver_0_homeowner: 'Rent',
        currently_insured: 'Yes',
        vehicles: '3',
      }),
    ).toBe('standard')
    expect(
      classifyLeadTier({
        homeowner: 'Yes',
        currently_insured: 'No',
        vehicles: '2',
      }),
    ).toBe('standard')
    expect(classifyLeadTier({})).toBe('standard')
  })
})

describe('resolveLeadTier', () => {
  const premiumFields = {
    homeowner: 'Yes',
    insured: 'Yes',
    vehicles: '2',
  }

  it('prefers the tier stored at ingest when trust passes', () => {
    expect(
      resolveLeadTier('premium', {}, {
        scoreAvailable: true,
        label: 'legit',
        effectiveLabel: 'legit',
        score: 62,
      }),
    ).toBe('premium')
  })

  it('classifies from fields when nothing was stored', () => {
    expect(resolveLeadTier('', premiumFields)).toBe('premium')
  })

  it('demotes premium to standard when trust flags fraud', () => {
    expect(
      resolveLeadTier('premium', premiumFields, {
        scoreAvailable: true,
        label: 'fraud',
        effectiveLabel: 'fraud',
        score: 32,
      }),
    ).toBe('standard')
  })

  it('demotes premium when score is below the fraud threshold', () => {
    expect(
      resolveLeadTier('premium', premiumFields, {
        scoreAvailable: true,
        label: 'legit',
        effectiveLabel: 'legit',
        score: 49,
      }),
    ).toBe('standard')
  })

  it('keeps premium when scoring is unavailable', () => {
    expect(
      resolveLeadTier('premium', premiumFields, {
        scoreAvailable: false,
        label: 'fraud',
        effectiveLabel: 'fraud',
        score: null,
      }),
    ).toBe('premium')
  })
})

describe('leadTierForIngestEvent', () => {
  it('classifies submit events from encrypted field blobs', () => {
    const blob = encryptFieldBlob({
      driver_0_homeowner_yes: 'on',
      currently_insured: 'Yes',
      car_0_make: 'Honda',
      car_1_make: 'Ford',
    })
    expect(blob).toBeTruthy()
    expect(
      leadTierForIngestEvent('form_success', { [OPAQUE_PROP_KEY]: blob }),
    ).toBe('premium')
  })

  it('classifies plain field props', () => {
    expect(
      leadTierForIngestEvent('form_submit', {
        fields: { homeowner: 'Yes', insured: 'No', vehicles: '2' },
      }),
    ).toBe('standard')
  })

  it('leaves non-lead events and empty forms unclassified', () => {
    expect(
      leadTierForIngestEvent('page_view', {
        fields: { homeowner: 'Yes', insured: 'Yes', vehicles: '2' },
      }),
    ).toBe('')
    expect(leadTierForIngestEvent('form_success', {})).toBe('')
  })
})
