import { describe, expect, it } from 'vitest'
import {
  fieldsWithoutReserved,
  isDisplayableLead,
  normalizeLeadFields,
  pickLeadEmail,
  pickLeadZip,
  pickTrustedFormUrl,
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

  it('composes dob from month/day/year parts and drops the parts', () => {
    expect(
      normalizeLeadFields({
        'dob-0-month': '3',
        'dob-0-day': '9',
        'dob-0-year': '1990',
        city: 'Austin',
      }),
    ).toEqual({
      dob: '03/09/1990',
      city: 'Austin',
    })
  })

  it('drops unusable dob fragments', () => {
    expect(
      normalizeLeadFields({
        'dob-0-month': '1',
        'dob-0-day': '1',
        'dob-0-year': '1',
        city: 'Austin',
      }),
    ).toEqual({ city: 'Austin' })
  })

  it('drops tracking and generic tag-name keys', () => {
    expect(
      normalizeLeadFields({
        TrustedFormCertUrl: 'https://cert.trustedform.com/abc',
        xxTrustedFormPingUrl: 'https://ping.trustedform.com/abc',
        jornaya_lead_id: '9EF3D769-E688',
        'consent-confirmation-certificate-id': '00745015',
        input: 'Elias',
        select: 'CHE',
        first_name: 'David',
      }),
    ).toEqual({ first_name: 'David' })
  })

  it('drops hashed email digests', () => {
    const digest = 'a'.repeat(64)
    expect(normalizeLeadFields({ email: digest, city: 'Austin' })).toEqual({
      city: 'Austin',
    })
  })

  it('maps Spanish Nombre_de_pila / Apellido onto first_name / last_name', () => {
    expect(
      normalizeLeadFields({
        Nombre_de_pila: 'Raul',
        Apellido: 'Garcia',
        address: '123 Main',
        unit: 'Casa',
      }),
    ).toEqual({
      first_name: 'Raul',
      last_name: 'Garcia',
      address: '123 Main, Casa',
    })
  })

  it('keeps explicit first_name / last_name over aliases', () => {
    expect(
      normalizeLeadFields({
        first_name: 'Ada',
        last_name: 'Lovelace',
        Nombre_de_pila: 'Ignored',
        Apellido: 'Ignored',
      }),
    ).toEqual({
      first_name: 'Ada',
      last_name: 'Lovelace',
    })
  })

  it('maps common English name aliases', () => {
    expect(
      normalizeLeadFields({
        'first-name': 'Sam',
        lastname: 'Lee',
      }),
    ).toEqual({
      first_name: 'Sam',
      last_name: 'Lee',
    })
  })

  it('maps multilingual and branded name labels onto first_name / last_name', () => {
    expect(
      normalizeLeadFields({
        primeiro_nome: 'Andre',
        sobrenome: 'Ribeiro',
        tên: 'Chieu',
        имя: 'Sergey',
        фамилия: 'Bultukov',
        'الاسم الأول': 'Mahmoud',
        'اسم العائلة': 'A nofall',
        이름: 'Michael',
        성: 'Kim',
        best_primeiro_nome: 'IgnoredBecauseCanonicalFilled',
        address: '9 Oak',
        unit: '1A',
      }),
    ).toEqual({
      first_name: 'Andre',
      last_name: 'Ribeiro',
      address: '9 Oak, 1A',
    })
  })

  it('maps browser-locale name labels from the leads table onto first_name / last_name', () => {
    expect(
      normalizeLeadFields({
        İlk_adı: 'Ahmet',
        Soy_isim: 'Yilmaz',
        Nombre: 'Carlos',
        Nome: 'Luca',
        Nome_di_battesimo: 'Giulia',
        نام: 'Reza',
        نام_خانوادگی: 'Karimi',
      }),
    ).toEqual({
      first_name: 'Ahmet',
      last_name: 'Yilmaz',
    })
  })

  it('maps Spanish Nombre / Italian Nome when they are the only first-name key', () => {
    expect(
      normalizeLeadFields({
        Nombre: 'Maria',
        Apellido: 'Lopez',
      }),
    ).toEqual({
      first_name: 'Maria',
      last_name: 'Lopez',
    })
    expect(
      normalizeLeadFields({
        Nome_di_battesimo: 'Marco',
        cognome: 'Rossi',
      }),
    ).toEqual({
      first_name: 'Marco',
      last_name: 'Rossi',
    })
    expect(
      normalizeLeadFields({
        نام: 'Sara',
        نام_خانوادگی: 'Ahmadi',
      }),
    ).toEqual({
      first_name: 'Sara',
      last_name: 'Ahmadi',
    })
  })

  it('folds unit into address and drops the unit column', () => {
    expect(
      normalizeLeadFields({
        address: '500 Brickell Ave',
        unit: 'Apt 12',
        city: 'Miami',
      }),
    ).toEqual({
      address: '500 Brickell Ave, Apt 12',
      city: 'Miami',
    })
    expect(
      normalizeLeadFields({
        unit: '2B',
        city: 'Austin',
      }),
    ).toEqual({
      address: '2B',
      city: 'Austin',
    })
  })

  it('maps a single non-English first-name label when no EN key exists', () => {
    expect(
      normalizeLeadFields({
        이름: 'Michael',
        성: 'Kim',
      }),
    ).toEqual({
      first_name: 'Michael',
      last_name: 'Kim',
    })
  })

  it('drops receipt control labels as noise', () => {
    expect(
      normalizeLeadFields({
        receipt: 'email',
        first_name: 'Ada',
      }),
    ).toEqual({ first_name: 'Ada' })
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

describe('pickTrustedFormUrl', () => {
  it('prefers xxTrustedFormCertUrl certificate URL', () => {
    expect(
      pickTrustedFormUrl({
        xxTrustedFormCertUrl:
          'https://cert.trustedform.com/b1ca89aa43369be1f60b58d779b13b19a5b06b67',
        xxTrustedFormPingUrl: 'https://ping.trustedform.com/abc',
      }),
    ).toBe(
      'https://cert.trustedform.com/b1ca89aa43369be1f60b58d779b13b19a5b06b67',
    )
  })

  it('builds cert URL from a 40-char token hash', () => {
    expect(
      pickTrustedFormUrl({
        xxTrustedFormToken: 'b1ca89aa43369be1f60b58d779b13b19a5b06b67',
      }),
    ).toBe(
      'https://cert.trustedform.com/b1ca89aa43369be1f60b58d779b13b19a5b06b67',
    )
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
