import { createClient } from "@clickhouse/client"
import { config } from "dotenv"
import path from "node:path"

config({ path: path.resolve(process.cwd(), "apps/dashboard/.env.local") })

const url = process.env.CLICKHOUSE_URL?.trim()
if (!url) {
  console.error(
    "Missing CLICKHOUSE_URL. Set CLICKHOUSE_* in apps/dashboard/.env.local or .env at the repo root."
  )
  process.exit(1)
}

const client = createClient({
  url,
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD,
})

const EXPECTED_COLUMNS = [
  "event_name",
  "workspace_id",
  "lp_public_id",
  "user_id",
  "session_id",
  "fingerprint",
  "url",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_s1",
  "referrer",
  "referrer_source",
  "browser",
  "os",
  "device",
  "variant",
  "country",
  "city",
  "metric_name",
  "metric_value",
  "properties",
  "trace_id",
  "created_at",
  "state",
  "zipcode",
  "event_date_et",
] as const

const EVENTS_TABLE = "events_raw"

const CREATE_EVENTS = `
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
    created_at DateTime64(3, 'UTC') DEFAULT now64(3, 'UTC'),
    event_date_et Date MATERIALIZED toDate(created_at, 'America/New_York')
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date_et)
ORDER BY (workspace_id, event_date_et, event_name);
`

const HEATMAP_EVENTS_TABLE = "heatmap_events"

const HEATMAP_GRID_X = "toInt32(floor(least(greatest(x, 0.), 1.) * 10.)) * 10"
const HEATMAP_GRID_Y = "toInt32(floor(least(greatest(y, 0.), 1.) * 10.)) * 10"
const HEATMAP_DEVICE_EXPR =
  "if(device != '', device, multiIf(viewport_width < 768, 'mobile', viewport_width < 1024, 'tablet', 'desktop'))"

const CREATE_HEATMAP_EVENTS = `
CREATE TABLE IF NOT EXISTS ${HEATMAP_EVENTS_TABLE} (
    workspace_id UUID,
    page_url String,
    event_type LowCardinality(String),
    timestamp DateTime64(3) DEFAULT now64(3),
    x Float64 DEFAULT 0,
    y Float64 DEFAULT 0,
    viewport_width Int32 DEFAULT 0,
    viewport_height Int32 DEFAULT 0,
    device LowCardinality(String) DEFAULT '',
    element_selector String DEFAULT '',
    properties String DEFAULT ''
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (workspace_id, page_url, event_type, timestamp)
TTL toDateTime(timestamp) + toIntervalDay(180);
`

async function ensureHeatmapEvents(): Promise<void> {
  await client.command({ query: CREATE_HEATMAP_EVENTS })
  await client.command({
    query: `ALTER TABLE ${HEATMAP_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS device LowCardinality(String) DEFAULT ''`,
  })
  await client.command({
    query: `ALTER TABLE ${HEATMAP_EVENTS_TABLE} MODIFY TTL toDateTime(timestamp) + toIntervalDay(180)`,
  })

  await client.command({
    query: `
      CREATE TABLE IF NOT EXISTS heatmap_clicks_rollup (
          workspace_id UUID,
          page_url String,
          device LowCardinality(String),
          day Date,
          grid_x Int32,
          grid_y Int32,
          clicks AggregateFunction(count)
      ) ENGINE = AggregatingMergeTree()
      ORDER BY (workspace_id, page_url, device, day, grid_x, grid_y)
    `,
  })

  await client.command({ query: "DROP VIEW IF EXISTS heatmap_clicks_mv" })
  await client.command({
    query: `
      CREATE MATERIALIZED VIEW IF NOT EXISTS heatmap_clicks_mv
      TO heatmap_clicks_rollup
      AS SELECT
          workspace_id,
          page_url,
          ${HEATMAP_DEVICE_EXPR} AS device,
          toDate(timestamp) AS day,
          ${HEATMAP_GRID_X} AS grid_x,
          ${HEATMAP_GRID_Y} AS grid_y,
          countState() AS clicks
      FROM ${HEATMAP_EVENTS_TABLE}
      WHERE event_type = 'click'
      GROUP BY workspace_id, page_url, device, day, grid_x, grid_y
    `,
  })

  await client.command({
    query: `
      CREATE TABLE IF NOT EXISTS heatmap_scroll_rollup (
          workspace_id UUID,
          page_url String,
          device LowCardinality(String),
          day Date,
          scroll_depth_bucket Int32,
          events AggregateFunction(count)
      ) ENGINE = AggregatingMergeTree()
      ORDER BY (workspace_id, page_url, device, day, scroll_depth_bucket)
    `,
  })

  await client.command({ query: "DROP VIEW IF EXISTS heatmap_scroll_mv" })
  await client.command({
    query: `
      CREATE MATERIALIZED VIEW IF NOT EXISTS heatmap_scroll_mv
      TO heatmap_scroll_rollup
      AS SELECT
          workspace_id,
          page_url,
          ${HEATMAP_DEVICE_EXPR} AS device,
          toDate(timestamp) AS day,
          ${HEATMAP_GRID_Y} AS scroll_depth_bucket,
          countState() AS events
      FROM ${HEATMAP_EVENTS_TABLE}
      WHERE event_type = 'scroll'
      GROUP BY workspace_id, page_url, device, day, scroll_depth_bucket
    `,
  })
}

async function tableExists(): Promise<boolean> {
  const r = await client.query({
    query: `SELECT count() AS n FROM system.tables WHERE database = currentDatabase() AND name = '${EVENTS_TABLE}'`,
    format: "JSON",
  })
  const json = (await r.json()) as { data: Array<{ n: string | number }> }
  return Number(json.data[0]?.n ?? 0) > 0
}

async function readColumns(): Promise<string[]> {
  const r = await client.query({
    query: `SELECT name FROM system.columns WHERE database = currentDatabase() AND table = '${EVENTS_TABLE}' ORDER BY position`,
    format: "JSON",
  })
  const json = (await r.json()) as { data: Array<{ name: string }> }
  return json.data.map((row) => row.name)
}

async function ensureAdditiveColumns(): Promise<void> {
  await client.command({
    query: `ALTER TABLE ${EVENTS_TABLE} ADD COLUMN IF NOT EXISTS state LowCardinality(String) DEFAULT ''`,
  })
  await client.command({
    query: `ALTER TABLE ${EVENTS_TABLE} ADD COLUMN IF NOT EXISTS zipcode LowCardinality(String) DEFAULT ''`,
  })
  await client.command({
    query: `ALTER TABLE ${EVENTS_TABLE} ADD COLUMN IF NOT EXISTS event_date_et Date MATERIALIZED toDate(created_at, 'America/New_York')`,
  })
}

async function readTableMeta(): Promise<{
  partitionKey: string
  sortingKey: string
}> {
  const r = await client.query({
    query: `SELECT partition_key AS partitionKey, sorting_key AS sortingKey FROM system.tables WHERE database = currentDatabase() AND name = '${EVENTS_TABLE}'`,
    format: "JSON",
  })
  const json = (await r.json()) as {
    data: Array<{ partitionKey: string; sortingKey: string }>
  }
  return {
    partitionKey: json.data[0]?.partitionKey ?? "",
    sortingKey: json.data[0]?.sortingKey ?? "",
  }
}

const EXPECTED_PARTITION_KEYS = [
  "toYYYYMM(event_date_et)",
  "toYYYYMM(created_at)",
] as const
const EXPECTED_SORTING_KEYS = [
  "workspace_id, event_date_et, event_name",
  "workspace_id, toDate(created_at), event_name",
] as const

function metaMatches(meta: {
  partitionKey: string
  sortingKey: string
}): boolean {
  const compactPartition = meta.partitionKey.replace(/\s+/g, "")
  const compactSorting = meta.sortingKey.replace(/\s+/g, "")
  return (
    EXPECTED_PARTITION_KEYS.some(
      (key) => key.replace(/\s+/g, "") === compactPartition
    ) &&
    EXPECTED_SORTING_KEYS.some(
      (key) => key.replace(/\s+/g, "") === compactSorting
    )
  )
}

async function rowCount(): Promise<number> {
  const r = await client.query({
    query: `SELECT count() AS n FROM ${EVENTS_TABLE}`,
    format: "JSON",
  })
  const json = (await r.json()) as { data: Array<{ n: string | number }> }
  return Number(json.data[0]?.n ?? 0)
}

function columnsMatch(actual: string[]): boolean {
  const names = new Set(actual)
  return EXPECTED_COLUMNS.every((column) => names.has(column))
}

async function ensureDailyMetrics(): Promise<void> {
  await client.command({
    query: `
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
    `,
  })

  await client.command({ query: "DROP VIEW IF EXISTS daily_metrics_mv" })

  await client.command({
    query: `
      CREATE MATERIALIZED VIEW IF NOT EXISTS daily_metrics_mv
      TO daily_metrics AS
      SELECT
          workspace_id,
          toDate(created_at, 'America/New_York') AS day,
          sum(if(event_name = 'page_view', 1, 0)) AS pageviews,
          uniqStateIf(user_id, event_name = 'page_view') AS visitors,
          uniqState(session_id) AS sessions,
          uniqStateIf(session_id, event_name IN ('button_click','link_click','form_start','scroll_depth')) AS interactions,
          uniqStateIf(session_id, event_name = 'form_start') AS form_started,
          uniqStateIf(session_id, event_name = 'form_success') AS form_submitted
      FROM ${EVENTS_TABLE}
      GROUP BY workspace_id, day
    `,
  })

  await client.command({
    query: `
      CREATE TABLE IF NOT EXISTS arohaa_schema_meta (
        key String,
        value String
      ) ENGINE = ReplacingMergeTree()
      ORDER BY key
    `,
  })

  const versionResult = await client.query({
    query: `
      SELECT value
      FROM arohaa_schema_meta FINAL
      WHERE key = 'daily_metrics_tz'
      LIMIT 1
    `,
    format: "JSON",
  })
  const versionJson = (await versionResult.json()) as {
    data: Array<{ value: string }>
  }
  if (versionJson.data[0]?.value === "america_new_york_v1") return

  const rawRows = await rowCount()

  await client.command({ query: "TRUNCATE TABLE IF EXISTS daily_metrics" })
  if (rawRows > 0) {
    console.log("Backfilling daily_metrics from events_raw...")
    await client.command({
      query: `
        INSERT INTO daily_metrics
        SELECT
            workspace_id,
            toDate(created_at, 'America/New_York') AS day,
            sum(if(event_name = 'page_view', 1, 0)) AS pageviews,
            uniqStateIf(user_id, event_name = 'page_view') AS visitors,
            uniqState(session_id) AS sessions,
            uniqStateIf(session_id, event_name IN ('button_click','link_click','form_start','scroll_depth')) AS interactions,
            uniqStateIf(session_id, event_name = 'form_start') AS form_started,
            uniqStateIf(session_id, event_name = 'form_success') AS form_submitted
        FROM ${EVENTS_TABLE}
        GROUP BY workspace_id, day
      `,
    })
  }

  await client.insert({
    table: "arohaa_schema_meta",
    values: [{ key: "daily_metrics_tz", value: "america_new_york_v1" }],
    format: "JSONEachRow",
  })
}

async function init() {
  try {
    console.log(`Connecting to ClickHouse at ${url}...`)

    const legacyExists = await client.query({
      query:
        "SELECT count() AS n FROM system.tables WHERE database = currentDatabase() AND name = 'events'",
      format: "JSON",
    })
    const legacyJson = (await legacyExists.json()) as {
      data: Array<{ n: string | number }>
    }
    const hasLegacy = Number(legacyJson.data[0]?.n ?? 0) > 0
    const exists = await tableExists()

    if (hasLegacy && !exists) {
      console.log("Renaming legacy events table to events_raw...")
      await client.command({ query: "RENAME TABLE events TO events_raw" })
    }

    const existsAfterRename = await tableExists()

    if (existsAfterRename) {
      await ensureAdditiveColumns()
      const cols = await readColumns()
      const meta = await readTableMeta()
      const schemaOk = columnsMatch(cols) && metaMatches(meta)

      if (schemaOk) {
        console.log(
          `${EVENTS_TABLE} schema matches. Ensuring daily_metrics views...`
        )
        await ensureDailyMetrics()
        console.log(`Ensuring ${HEATMAP_EVENTS_TABLE} table...`)
        await ensureHeatmapEvents()
        return
      }

      const rows = await rowCount()
      console.warn(`${EVENTS_TABLE} table exists with a different schema:`)
      console.warn(`  current columns:    ${cols.join(", ")}`)
      console.warn(`  expected columns:   ${EXPECTED_COLUMNS.join(", ")}`)
      console.warn(`  current partition:  ${meta.partitionKey || "(none)"}`)
      console.warn(
        `  expected partition: ${EXPECTED_PARTITION_KEYS.join(" or ")}`
      )
      console.warn(`  current order:      ${meta.sortingKey}`)
      console.warn(
        `  expected order:     ${EXPECTED_SORTING_KEYS.join(" or ")}`
      )
      console.warn(`  current row count:  ${rows}`)

      if (rows > 0 && process.env.FORCE_DROP !== "1") {
        console.error(
          "Refusing to drop a non-empty table. Re-run with FORCE_DROP=1 to confirm destructive migration."
        )
        process.exitCode = 1
        return
      }

      console.log(`Dropping old ${EVENTS_TABLE} table...`)
      await client.command({ query: `DROP TABLE IF EXISTS ${EVENTS_TABLE}` })
    }

    console.log(`Creating ${EVENTS_TABLE} table with new schema...`)
    await client.command({ query: CREATE_EVENTS })
    await ensureDailyMetrics()
    console.log(`Ensuring ${HEATMAP_EVENTS_TABLE} table...`)
    await ensureHeatmapEvents()
    console.log(`${EVENTS_TABLE} table, ${HEATMAP_EVENTS_TABLE}, and materialized views are ready.`)
  } catch (error) {
    console.error("Migration failed:", error)
    process.exitCode = 1
  } finally {
    await client.close()
  }
}

init()
