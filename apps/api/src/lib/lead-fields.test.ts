import { describe, expect, it } from 'vitest'
import {
  fieldsWithoutReserved,
  isDisplayableLead,
  normalizeLeadFields,
  pickLeadEmail,
  pickLeadZip,
} from './lead-fields.js'

describe('normalizeLeadFields', () => {
  it('collapses radio option keys with on values', () => {
    expect(
      normalizeLeadFields({
        car_0_make_BUI: 'on',
        car_0_year_2014: 'on',
        car_0_model_1270: 'on',
        driver_0_married_yes: 'on',
        second_vehicle: 'on',
        currently_insured: 'on',
        address: '123 Main',
        email: 'a@b.com',
      }),
    ).toEqual({
      car_0_make: 'BUI',
      car_0_year: '2014',
      car_0_model: '1270',
      driver_0_married: 'yes',
      second_vehicle: 'Yes',
      currently_insured: 'Yes',
      address: '123 Main',
      email: 'a@b.com',
    })
  })

  it('collapses when value matches option suffix', () => {
    expect(
      normalizeLeadFields({
        driver_0_gender_male: 'male',
      }),
    ).toEqual({ driver_0_gender: 'male' })
  })

  it('composes dob from month/day/year parts', () => {
    expect(
      normalizeLeadFields({
        'dob-0-month': '3',
        'dob-0-day': '9',
        'dob-0-year': '1990',
        city: 'Austin',
      }),
    ).toEqual({
      'dob-0-month': '3',
      'dob-0-day': '9',
      'dob-0-year': '1990',
      dob: '03/09/1990',
      city: 'Austin',
    })
  })

  it('drops hashed email digests', () => {
    const digest = 'a'.repeat(64)
    expect(normalizeLeadFields({ email: digest, city: 'Austin' })).toEqual({
      city: 'Austin',
    })
  })
})

describe('isDisplayableLead', () => {
  it('rejects digest-only or empty rows', () => {
    expect(isDisplayableLead({ zip: '', email: '', fields: {} })).toBe(false)
    expect(
      isDisplayableLead({
        zip: '',
        email: '',
        fields: { 'consent-confirmation-certificate-id': 'abc' },
      }),
    ).toBe(false)
    expect(
      isDisplayableLead({
        zip: '90210',
        email: '',
        fields: {},
      }),
    ).toBe(true)
    expect(
      isDisplayableLead({
        zip: '',
        email: 'a@b.com',
        fields: {},
      }),
    ).toBe(true)
    expect(
      isDisplayableLead({
        zip: '',
        email: '',
        fields: { address: '1 Main' },
      }),
    ).toBe(true)
  })
})

describe('pickLead helpers', () => {
  it('picks email and zip and hides dob parts when dob exists', () => {
    const fields = normalizeLeadFields({
      email: 'lead@example.com',
      zipcode: '90210',
      city: 'LA',
      'dob-0-month': '1',
      'dob-0-day': '2',
      'dob-0-year': '1988',
    })
    expect(pickLeadEmail(fields)).toBe('lead@example.com')
    expect(pickLeadZip(fields)).toBe('90210')
    expect(fieldsWithoutReserved(fields)).toEqual({
      city: 'LA',
      dob: '01/02/1988',
    })
  })
})
