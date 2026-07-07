import { createClient } from "@clickhouse/client"
import { config } from "dotenv"
import path from "node:path"

config({ path: path.resolve("apps/dashboard/.env.local") })

const EVENTS_TABLE = "events_raw"

const client = createClient({
  url: process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_USER ?? "default",
  password: process.env.CLICKHOUSE_PASSWORD,
})

async function tableExists(name: string): Promise<boolean> {
  const r = await client.query({
    query:
      "SELECT count() AS n FROM system.tables WHERE database = currentDatabase() AND name = {name:String}",
    query_params: { name },
    format: "JSON",
  })
  const json = (await r.json()) as { data: Array<{ n: string | number }> }
  return Number(json.data[0]?.n ?? 0) > 0
}

async function countRows(table: string): Promise<number> {
  const r = await client.query({
    query: `SELECT count() AS n FROM ${table}`,
    format: "JSON",
  })
  const json = (await r.json()) as { data: Array<{ n: string | number }> }
  return Number(json.data[0]?.n ?? 0)
}

const CREATE_EVENTS_RAW = `
CREATE TABLE IF NOT EXISTS ${EVENTS_TABLE} (
    event_name LowCardinality(String),
    workspace_id UUID,
    lp_public_id LowCardinality(String) DEFAULT '',
    user_id String,
    session_id String,
    fingerprint String DEFAULT '',
    url String,
    utm_source LowCardinality(String) DEFAULT '',
    utm_medium LowCardinality(String) DEFAULT '',
    utm_campaign String DEFAULT '',
    utm_term String DEFAULT '',
    utm_content String DEFAULT '',
    utm_id LowCardinality(String) DEFAULT '',
    utm_s1 LowCardinality(String) DEFAULT '',
    referrer String DEFAULT '',
    referrer_source LowCardinality(String) DEFAULT '',
    browser LowCardinality(String) DEFAULT '',
    os LowCardinality(String) DEFAULT '',
    device LowCardinality(String) DEFAULT 'desktop',
    variant LowCardinality(String) DEFAULT '',
    country LowCardinality(String) DEFAULT 'Unknown',
    city LowCardinality(String) DEFAULT '',
    metric_name LowCardinality(String) DEFAULT '',
    metric_value Float64 DEFAULT 0,
    properties String,
    trace_id String DEFAULT '',
    created_at DateTime64(3) DEFAULT now64()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (workspace_id, toDate(created_at), event_name)
`

const CREATE_DAILY_METRICS = `
CREATE TABLE IF NOT EXISTS daily_metrics (
    workspace_id UUID,
    day Date,
    pageviews SimpleAggregateFunction(sum, UInt64),
    visitors AggregateFunction(uniq, String),
    sessions AggregateFunction(uniq, String),
    interactions AggregateFunction(uniq, String),
    form_started AggregateFunction(uniq, String),
    form_submitted AggregateFunction(uniq, String)
) ENGINE = AggregatingMergeTree()
ORDER BY (workspace_id, day)
`

const CREATE_DAILY_METRICS_MV = `
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_metrics_mv
TO daily_metrics AS
SELECT
    workspace_id,
    toDate(created_at) AS day,
    sum(if(event_name = 'page_view', 1, 0)) AS pageviews,
    uniqStateIf(user_id, event_name = 'page_view') AS visitors,
    uniqState(session_id) AS sessions,
    uniqStateIf(session_id, event_name IN ('button_click','link_click','form_start','scroll_depth')) AS interactions,
    uniqStateIf(session_id, event_name = 'form_start') AS form_started,
    uniqStateIf(session_id, event_name = 'form_success') AS form_submitted
FROM ${EVENTS_TABLE}
GROUP BY workspace_id, day
`

const BACKFILL_DAILY_METRICS = `
INSERT INTO daily_metrics
SELECT
    workspace_id,
    toDate(created_at) AS day,
    sum(if(event_name = 'page_view', 1, 0)) AS pageviews,
    uniqStateIf(user_id, event_name = 'page_view') AS visitors,
    uniqState(session_id) AS sessions,
    uniqStateIf(session_id, event_name IN ('button_click','link_click','form_start','scroll_depth')) AS interactions,
    uniqStateIf(session_id, event_name = 'form_start') AS form_started,
    uniqStateIf(session_id, event_name = 'form_success') AS form_submitted
FROM ${EVENTS_TABLE}
GROUP BY workspace_id, day
`

async function main() {
  console.log(`Target: ${process.env.CLICKHOUSE_URL}`)

  const hasLegacy = await tableExists("events")
  const hasRaw = await tableExists(EVENTS_TABLE)

  if (hasLegacy && !hasRaw) {
    const legacyRows = await countRows("events")
    console.log(`Renaming events (${legacyRows} rows) -> events_raw`)
    await client.command({ query: "RENAME TABLE events TO events_raw" })
  } else if (hasLegacy && hasRaw) {
    console.warn("Both events and events_raw exist — manual merge may be required")
  } else if (!hasRaw) {
    console.log("Creating events_raw...")
    await client.command({ query: CREATE_EVENTS_RAW })
  }

  const rawRows = await countRows(EVENTS_TABLE)
  console.log(`${EVENTS_TABLE} row count: ${rawRows}`)

  console.log("Ensuring daily_metrics table...")
  await client.command({ query: CREATE_DAILY_METRICS })

  console.log("Recreating daily_metrics_mv...")
  await client.command({ query: "DROP VIEW IF EXISTS daily_metrics_mv" })
  await client.command({ query: CREATE_DAILY_METRICS_MV })

  const metricsRows = await countRows("daily_metrics")
  if (metricsRows === 0 && rawRows > 0) {
    console.log("Backfilling daily_metrics from historical events_raw...")
    await client.command({ query: BACKFILL_DAILY_METRICS })
  } else {
    console.log(`daily_metrics rows: ${metricsRows} (skip backfill)`)
  }

  const tables = await client.query({
    query:
      "SELECT name, engine FROM system.tables WHERE database = currentDatabase() ORDER BY name",
    format: "JSON",
  })
  console.log("Tables:", JSON.stringify((await tables.json()).data, null, 2))
  console.log("Done.")
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => client.close())
