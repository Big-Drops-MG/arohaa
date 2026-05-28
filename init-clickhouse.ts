import { createClient } from "@clickhouse/client"
import { config } from "dotenv"
import path from "node:path"

config({ path: path.resolve(process.cwd(), "apps/dashboard/.env.local") })

const url = process.env.CLICKHOUSE_URL?.trim()
if (!url) {
  console.error(
    "Missing CLICKHOUSE_URL. Set CLICKHOUSE_* in apps/dashboard/.env.local or .env at the repo root.",
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
  "referrer",
  "referrer_source",
  "browser",
  "os",
  "device",
  "country",
  "city",
  "metric_name",
  "metric_value",
  "properties",
  "trace_id",
  "created_at",
] as const

const CREATE_EVENTS = `
CREATE TABLE IF NOT EXISTS events (
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
    referrer String DEFAULT '',
    referrer_source LowCardinality(String) DEFAULT '',
    browser LowCardinality(String) DEFAULT '',
    os LowCardinality(String) DEFAULT '',
    device LowCardinality(String) DEFAULT 'desktop',
    country LowCardinality(String) DEFAULT 'Unknown',
    city LowCardinality(String) DEFAULT '',
    metric_name LowCardinality(String) DEFAULT '',
    metric_value Float64 DEFAULT 0,
    properties String,
    trace_id String DEFAULT '',
    created_at DateTime64(3) DEFAULT now64()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (workspace_id, toDate(created_at), event_name);
`

async function tableExists(): Promise<boolean> {
  const r = await client.query({
    query:
      "SELECT count() AS n FROM system.tables WHERE database = currentDatabase() AND name = 'events'",
    format: "JSON",
  })
  const json = (await r.json()) as { data: Array<{ n: string | number }> }
  return Number(json.data[0]?.n ?? 0) > 0
}

async function readColumns(): Promise<string[]> {
  const r = await client.query({
    query:
      "SELECT name FROM system.columns WHERE database = currentDatabase() AND table = 'events' ORDER BY position",
    format: "JSON",
  })
  const json = (await r.json()) as { data: Array<{ name: string }> }
  return json.data.map((row) => row.name)
}

async function readTableMeta(): Promise<{
  partitionKey: string
  sortingKey: string
}> {
  const r = await client.query({
    query:
      "SELECT partition_key AS partitionKey, sorting_key AS sortingKey FROM system.tables WHERE database = currentDatabase() AND name = 'events'",
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

const EXPECTED_PARTITION_KEY = "toYYYYMM(created_at)"
const EXPECTED_SORTING_KEY = "workspace_id, toDate(created_at), event_name"

function metaMatches(meta: { partitionKey: string; sortingKey: string }): boolean {
  return (
    meta.partitionKey.replace(/\s+/g, "") ===
      EXPECTED_PARTITION_KEY.replace(/\s+/g, "") &&
    meta.sortingKey.replace(/\s+/g, "") ===
      EXPECTED_SORTING_KEY.replace(/\s+/g, "")
  )
}

async function rowCount(): Promise<number> {
  const r = await client.query({
    query: "SELECT count() AS n FROM events",
    format: "JSON",
  })
  const json = (await r.json()) as { data: Array<{ n: string | number }> }
  return Number(json.data[0]?.n ?? 0)
}

function columnsMatch(actual: string[]): boolean {
  if (actual.length !== EXPECTED_COLUMNS.length) return false
  return EXPECTED_COLUMNS.every((c, i) => actual[i] === c)
}

async function init() {
  try {
    console.log("Connecting to ClickHouse Cloud...")

    const exists = await tableExists()

    if (exists) {
      const cols = await readColumns()
      const meta = await readTableMeta()
      if (columnsMatch(cols) && metaMatches(meta)) {
        console.log("events table already matches the expected schema. Nothing to do.")
        return
      }

      const rows = await rowCount()
      console.warn("events table exists with a different schema:")
      console.warn(`  current columns:    ${cols.join(", ")}`)
      console.warn(`  expected columns:   ${EXPECTED_COLUMNS.join(", ")}`)
      console.warn(`  current partition:  ${meta.partitionKey || "(none)"}`)
      console.warn(`  expected partition: ${EXPECTED_PARTITION_KEY}`)
      console.warn(`  current order:      ${meta.sortingKey}`)
      console.warn(`  expected order:     ${EXPECTED_SORTING_KEY}`)
      console.warn(`  current row count:  ${rows}`)

      if (rows > 0 && process.env.FORCE_DROP !== "1") {
        console.error(
          "Refusing to drop a non-empty table. Re-run with FORCE_DROP=1 to confirm destructive migration.",
        )
        process.exitCode = 1
        return
      }

      console.log("Dropping old events table...")
      await client.command({ query: "DROP TABLE IF EXISTS events" })
    }

    console.log("Creating events table with new schema...")
    await client.command({ query: CREATE_EVENTS })
    console.log("events table is ready.")
  } catch (error) {
    console.error("Migration failed:", error)
    process.exitCode = 1
  } finally {
    await client.close()
  }
}

init()
