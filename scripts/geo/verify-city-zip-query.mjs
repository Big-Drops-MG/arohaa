/**
 * Validates the overview cities submitted-zip SQL against ClickHouse and prints
 * submitted vs GeoIP zip counts per city so the map tooltip can be audited.
 *
 * Needs CLICKHOUSE_URL / CLICKHOUSE_USER / CLICKHOUSE_PASSWORD, and must run
 * from apps/api so @clickhouse/client resolves:
 *   cd apps/api
 *   node --env-file=../dashboard/.env ../../scripts/geo/verify-city-zip-query.mjs
 */
import { createClient } from "@clickhouse/client"

const SUBMITTED_ZIP_EXPR = `
  if(
    properties = '' OR properties = '{}',
    '',
    substring(
      replaceRegexpAll(
        coalesce(
          nullIf(replaceRegexpAll(JSONExtractRaw(properties, 'zip'), '"', ''), ''),
          nullIf(replaceRegexpAll(JSONExtractRaw(properties, 'zipCode'), '"', ''), ''),
          nullIf(replaceRegexpAll(JSONExtractRaw(properties, 'zipcode'), '"', ''), ''),
          nullIf(replaceRegexpAll(JSONExtractRaw(properties, 'fields', 'zip'), '"', ''), ''),
          nullIf(replaceRegexpAll(JSONExtractRaw(properties, 'fields', 'zipCode'), '"', ''), ''),
          nullIf(replaceRegexpAll(JSONExtractRaw(properties, 'fields', 'zipcode'), '"', ''), ''),
          nullIf(replaceRegexpAll(JSONExtractRaw(properties, 'fields', 'postal'), '"', ''), ''),
          ''
        ),
        '[^0-9]',
        ''
      ),
      1,
      5
    )
  )
`

const client = createClient({
  url: process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_USER ?? "default",
  password: process.env.CLICKHOUSE_PASSWORD,
})

const query = `
  SELECT
    state AS state,
    city AS city,
    uniqExactIf(submitted_zip, length(submitted_zip) = 5) AS zip_count,
    arraySlice(
      arraySort(groupUniqArrayIf(submitted_zip, length(submitted_zip) = 5)),
      1,
      250
    ) AS zipcodes,
    uniqExactIf(user_id, event_name = 'page_view') AS visitors,
    uniqExactIf(geo_zip, geo_zip != '') AS geoip_zip_count
  FROM (
    SELECT
      state,
      city,
      user_id,
      event_name,
      zipcode AS geo_zip,
      ${SUBMITTED_ZIP_EXPR} AS submitted_zip
    FROM events_raw
    WHERE country IN ('United States', 'USA', 'US') AND city != ''
  )
  GROUP BY state, city
  ORDER BY visitors DESC
  LIMIT 20
`

try {
  const res = await client.query({ query, format: "JSON" })
  const { data } = await res.json()
  console.log("[verify] query OK, rows:", data.length)
  for (const row of data) {
    console.log(
      `${row.state} / ${row.city} | visitors=${row.visitors} | submitted_zips=${row.zip_count} ${JSON.stringify(row.zipcodes)} | geoip_zips=${row.geoip_zip_count}`
    )
  }
} catch (err) {
  console.error("[verify] query FAILED:", err.message)
  process.exitCode = 1
} finally {
  await client.close()
}
