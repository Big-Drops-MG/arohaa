import { lookupCountyFipsForZip, normalizeUsZip } from './us-zip-county.service.js'

const STATE_FIPS_TO_CODE: Record<string, string> = {
  '01': 'AL',
  '02': 'AK',
  '04': 'AZ',
  '05': 'AR',
  '06': 'CA',
  '08': 'CO',
  '09': 'CT',
  '10': 'DE',
  '11': 'DC',
  '12': 'FL',
  '13': 'GA',
  '15': 'HI',
  '16': 'ID',
  '17': 'IL',
  '18': 'IN',
  '19': 'IA',
  '20': 'KS',
  '21': 'KY',
  '22': 'LA',
  '23': 'ME',
  '24': 'MD',
  '25': 'MA',
  '26': 'MI',
  '27': 'MN',
  '28': 'MS',
  '29': 'MO',
  '30': 'MT',
  '31': 'NE',
  '32': 'NV',
  '33': 'NH',
  '34': 'NJ',
  '35': 'NM',
  '36': 'NY',
  '37': 'NC',
  '38': 'ND',
  '39': 'OH',
  '40': 'OK',
  '41': 'OR',
  '42': 'PA',
  '44': 'RI',
  '45': 'SC',
  '46': 'SD',
  '47': 'TN',
  '48': 'TX',
  '49': 'UT',
  '50': 'VT',
  '51': 'VA',
  '53': 'WA',
  '54': 'WV',
  '55': 'WI',
  '56': 'WY',
  '72': 'PR',
}

export type EnteredZipRegion = {
  zip: string
  countryCode: string
  stateCode: string
  countyFips: string
  source: 'us_zip_county_reference'
  available: boolean
}


export function resolveEnteredZipRegion(rawZip: string): EnteredZipRegion {
  const zip = normalizeUsZip(rawZip)
  if (!zip) {
    return {
      zip: '',
      countryCode: '',
      stateCode: '',
      countyFips: '',
      source: 'us_zip_county_reference',
      available: false,
    }
  }
  const countyFips = lookupCountyFipsForZip(zip)
  if (!countyFips || countyFips.length < 2) {
    return {
      zip,
      countryCode: 'US',
      stateCode: '',
      countyFips: '',
      source: 'us_zip_county_reference',
      available: false,
    }
  }
  const stateCode = STATE_FIPS_TO_CODE[countyFips.slice(0, 2)] || ''
  return {
    zip,
    countryCode: 'US',
    stateCode,
    countyFips,
    source: 'us_zip_county_reference',
    available: Boolean(stateCode),
  }
}
