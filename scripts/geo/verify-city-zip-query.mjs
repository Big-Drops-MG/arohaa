/**
 * Validates the overview cities zip SQL against ClickHouse and prints distinct
 * zip counts per city from the `zipcode` column (GeoIP + form-submitted).
 *
 * Needs CLICKHOUSE_URL / CLICKHOUSE_USER / CLICKHOUSE_PASSWORD, and must run
 * from apps/api so @clickhouse/client resolves:
 *   cd apps/api
 *   node --env-file=../dashboard/.env ../../scripts/geo/verify-city-zip-query.mjs
 */
import { createClient } from "@clickhouse/client"

const client = createClient({
  url: process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_USER ?? "default",
  password: process.env.CLICKHOUSE_PASSWORD,
})

const query = `
  SELECT
    state AS state,
    city AS city,
    uniqExactIf(zipcode, zipcode != '') AS zip_count,
    arraySlice(
      arraySort(groupUniqArrayIf(toString(zipcode), zipcode != '')),
      1,
      250
    ) AS zipcodes,
    uniqExactIf(user_id, event_name = 'page_view') AS visitors
  FROM events_raw
  WHERE country IN ('United States', 'USA', 'US') AND city != ''
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
      `${row.state} / ${row.city} | visitors=${row.visitors} | zips=${row.zip_count} ${JSON.stringify(row.zipcodes)}`
    )
  }
} catch (err) {
  console.error("[verify] query FAILED:", err.message)
  process.exitCode = 1
} finally {
  await client.close()
}
