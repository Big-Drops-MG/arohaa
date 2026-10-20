import { resolveEnteredZipRegion } from '../../services/us-zip-geo.service.js'

export type LocationComparisonResult =
  | 'consistent'
  | 'minor_difference'
  | 'inconsistency'
  | 'unavailable'

export type LocationComparison = {
  result: LocationComparisonResult
  enteredZip: string
  enteredCountryCode: string
  enteredStateCode: string
  ipCountryCode: string
  ipCountry: string
  ipStateCode: string
  ipCity: string
  ipPostalUnreliable: string
  detail: string
  evidenceSource: string
}

function normalizeCountryCode(raw: string): string {
  const v = raw.trim().toUpperCase()
  if (!v || v === 'UNKNOWN') return ''
  if (v === 'US' || v === 'USA' || v === 'UNITED STATES') return 'US'
  if (v.length === 2) return v
  return v
}


export function compareEnteredZipToIpGeo(input: {
  formZipEntered: string
  ipCountry: string
  ipCountryCode?: string
  ipStateCode: string
  ipCity: string
  ipPostal?: string
}): LocationComparison {
  const entered = resolveEnteredZipRegion(input.formZipEntered)
  const ipCountryCode = normalizeCountryCode(
    input.ipCountryCode || input.ipCountry,
  )
  const ipStateCode = input.ipStateCode.trim().toUpperCase()
  const ipCity = input.ipCity.trim()
  const ipPostalUnreliable = (input.ipPostal || '').trim()

  const base = {
    enteredZip: entered.zip,
    enteredCountryCode: entered.countryCode,
    enteredStateCode: entered.stateCode,
    ipCountryCode,
    ipCountry: input.ipCountry.trim(),
    ipStateCode,
    ipCity,
    ipPostalUnreliable,
    evidenceSource:
      'entered_zip→us_zip_county_reference vs ip_geo(country/state/city)',
  }

  if (!entered.zip) {
    return {
      ...base,
      result: 'unavailable',
      detail: 'Entered ZIP missing; location comparison unavailable',
    }
  }
  if (!entered.available || !entered.stateCode) {
    return {
      ...base,
      result: 'unavailable',
      detail:
        'Entered ZIP could not be resolved to a state via postal reference; comparison unavailable',
    }
  }
  if (!ipCountryCode && !ipStateCode) {
    return {
      ...base,
      result: 'unavailable',
      detail:
        'IP geolocation missing or unreliable; location comparison unavailable',
    }
  }

  if (ipCountryCode && entered.countryCode && ipCountryCode !== entered.countryCode) {
    return {
      ...base,
      result: 'inconsistency',
      detail: `Entered ZIP region (${entered.countryCode}/${entered.stateCode}) differs in country from IP geo (${ipCountryCode})`,
    }
  }

  if (ipStateCode && entered.stateCode && ipStateCode !== entered.stateCode) {
    return {
      ...base,
      result: 'inconsistency',
      detail: `Entered ZIP state ${entered.stateCode} differs from IP geo state ${ipStateCode}`,
    }
  }

  if (ipStateCode && entered.stateCode && ipStateCode === entered.stateCode) {
    return {
      ...base,
      result: 'consistent',
      detail: `Entered ZIP state ${entered.stateCode} agrees with IP geo state`,
    }
  }

  if (ipCountryCode === entered.countryCode && !ipStateCode) {
    return {
      ...base,
      result: 'minor_difference',
      detail:
        'Country-level agreement only; IP state unavailable — informational, not verified',
    }
  }

  return {
    ...base,
    result: 'unavailable',
    detail: 'Insufficient overlapping location fields for a reliable comparison',
  }
}
