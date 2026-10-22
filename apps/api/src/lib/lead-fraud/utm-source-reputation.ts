import { CLICKHOUSE_EVENTS_TABLE } from '../clickhouse-events-table.js'
import { getClickHouseClient } from '../../services/clickhouse.service.js'
import { normalizeLeadFields, pickLeadZip } from '../lead-fields.js'
import { usStateCodeFromNameOrCode } from '../us-states.js'
import { extractRawFieldMap } from './field-signals.js'
import { compareEnteredZipToIpGeo } from './location-compare.js'

export const UTM_SOURCE_REPUTATION_LOOKBACK_DAYS = 30
export const UTM_SOURCE_REPUTATION_MIN_SUBMITS = 10
export const UTM_SOURCE_REPUTATION_MISMATCH_RATE = 0.7

export type UtmSourceReputationStatus =
  | 'clean'
  | 'location_mismatch_cluster'
  | 'unknown'

export type UtmSourceReputation = {
  source: string
  status: UtmSourceReputationStatus
  submitCount: number
  locationMismatchCount: number
  rate: number
}

type CHJson<T> = { data: T[] }

type RawRepRow = {
  session_id: string
  utm_source: string
  geo_state: string
  geo_state_name: string
  geo_country: string
  geo_country_code: string
  geo_city: string
  zip_val: string
  props: string
}

function extractFormZip(zipVal: string, props: string): string {
  const fromCol = String(zipVal || '').trim()
  if (fromCol) return fromCol
  try {
    const fields = normalizeLeadFields(extractRawFieldMap(props || '{}'))
    return pickLeadZip(fields).trim()
  } catch {
    return ''
  }
}

/**
 * Pure threshold logic — used by loader and unit tests.
 * Empty source is never tainted.
 */
export function evaluateUtmSourceReputation(input: {
  source: string
  submitCount: number
  locationMismatchCount: number
  minSubmits?: number
  mismatchRate?: number
}): UtmSourceReputation {
  const source = input.source.trim()
  const submitCount = Math.max(0, Math.floor(input.submitCount))
  const locationMismatchCount = Math.max(
    0,
    Math.min(submitCount, Math.floor(input.locationMismatchCount)),
  )
  const minSubmits = input.minSubmits ?? UTM_SOURCE_REPUTATION_MIN_SUBMITS
  const mismatchRate =
    input.mismatchRate ?? UTM_SOURCE_REPUTATION_MISMATCH_RATE
  const rate = submitCount > 0 ? locationMismatchCount / submitCount : 0

  if (!source) {
    return {
      source: '',
      status: 'unknown',
      submitCount,
      locationMismatchCount,
      rate,
    }
  }
  if (submitCount < minSubmits) {
    return {
      source,
      status: 'unknown',
      submitCount,
      locationMismatchCount,
      rate,
    }
  }
  if (rate >= mismatchRate) {
    return {
      source,
      status: 'location_mismatch_cluster',
      submitCount,
      locationMismatchCount,
      rate,
    }
  }
  return {
    source,
    status: 'clean',
    submitCount,
    locationMismatchCount,
    rate,
  }
}

export function utmSourceReputationToken(
  rep: UtmSourceReputation | null | undefined,
): string {
  if (!rep || !rep.source) return 'utmrep:none'
  return `utmrep:${rep.source}:${rep.status}:${rep.submitCount}:${rep.locationMismatchCount}`
}

/**
 * Rolling location-mismatch rate per utm_source for one landing page.
 * Live ZIP↔IP compare on submit sessions (not lead_risk) so cold starts work.
 */
export async function loadUtmSourceReputation(input: {
  workspaceId: string
  sources: string[]
  lookbackDays?: number
}): Promise<Map<string, UtmSourceReputation>> {
  const out = new Map<string, UtmSourceReputation>()
  const wid = input.workspaceId.trim()
  const sources = [
    ...new Set(
      input.sources
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length <= 200),
    ),
  ]
  if (!wid || sources.length === 0) return out

  const lookbackDays = Math.max(
    1,
    Math.min(90, Math.floor(input.lookbackDays ?? UTM_SOURCE_REPUTATION_LOOKBACK_DAYS)),
  )

  const tallies = new Map<
    string,
    { submitCount: number; locationMismatchCount: number }
  >()
  for (const source of sources) {
    tallies.set(source, { submitCount: 0, locationMismatchCount: 0 })
  }

  try {
    const ch = getClickHouseClient()
    for (let i = 0; i < sources.length; i += 50) {
      const chunk = sources.slice(i, i + 50)
      const res = await ch.query({
        format: 'JSON',
        query_params: { wid, sources: chunk, lookback_days: lookbackDays },
        query: `
          SELECT
            session_id,
            anyIf(utm_source, utm_source != '') AS utm_source,
            anyIf(state_code, state_code != '') AS geo_state,
            anyIf(state, state != '') AS geo_state_name,
            anyIf(country, country != '') AS geo_country,
            anyIf(country_code, country_code != '') AS geo_country_code,
            anyIf(city, city != '') AS geo_city,
            coalesce(
              nullIf(max(form_zip_entered), ''),
              nullIf(max(zipcode), '')
            ) AS zip_val,
            argMax(properties, (length(properties), created_at)) AS props
          FROM ${CLICKHOUSE_EVENTS_TABLE}
          WHERE workspace_id = {wid:UUID}
            AND event_date_et >= today() - {lookback_days:UInt32} - 1
            AND created_at >= now64(3, 'UTC') - toIntervalDay({lookback_days:UInt32})
            AND event_name IN ('form_submit', 'form_success')
            AND session_id != ''
            AND utm_source IN {sources:Array(String)}
          GROUP BY session_id
          LIMIT 20000
        `,
      })
      const rows =
        ((await res.json()) as CHJson<RawRepRow>).data ?? []
      for (const row of rows) {
        const source = String(row.utm_source || '').trim()
        const tally = tallies.get(source)
        if (!tally) continue
        const geoState =
          String(row.geo_state || '').trim().toUpperCase() ||
          usStateCodeFromNameOrCode(String(row.geo_state_name || ''))
        const geoCountryCode = String(row.geo_country_code || '').trim()
        const geoCountry = String(row.geo_country || '').trim()
        if (!geoState && !geoCountryCode && !geoCountry) continue

        const formZip = extractFormZip(row.zip_val, row.props)
        const comparison = compareEnteredZipToIpGeo({
          formZipEntered: formZip,
          ipCountry: geoCountry,
          ipCountryCode: geoCountryCode,
          ipStateCode: geoState,
          ipCity: String(row.geo_city || '').trim(),
        })
        if (comparison.result === 'unavailable') continue
        tally.submitCount += 1
        if (comparison.result === 'inconsistency') {
          tally.locationMismatchCount += 1
        }
      }
    }
  } catch (err) {
    console.error('[lead-fraud] utm source reputation load failed', err)
    for (const source of sources) {
      out.set(
        source,
        evaluateUtmSourceReputation({
          source,
          submitCount: 0,
          locationMismatchCount: 0,
        }),
      )
    }
    return out
  }

  for (const [source, tally] of tallies) {
    out.set(
      source,
      evaluateUtmSourceReputation({
        source,
        submitCount: tally.submitCount,
        locationMismatchCount: tally.locationMismatchCount,
      }),
    )
  }
  return out
}
