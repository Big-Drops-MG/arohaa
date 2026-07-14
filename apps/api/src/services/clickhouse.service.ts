import { createClient, type ClickHouseClient } from '@clickhouse/client'
import type { EventRow } from '../types/event.js'
import { CLICKHOUSE_EVENTS_TABLE } from '../lib/clickhouse-events-table.js'
import { chToDate } from '../lib/analytics-timezone.js'

const CREATE_EVENTS_SQL = `
CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_EVENTS_TABLE} (
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
    state LowCardinality(String) DEFAULT '',
    zipcode LowCardinality(String) DEFAULT '',
    metric_name LowCardinality(String) DEFAULT '',
    metric_value Float64 DEFAULT 0,
    properties String,
    trace_id String DEFAULT '',
    created_at DateTime64(3, 'UTC') DEFAULT now64(3, 'UTC'),
    event_date_et Date MATERIALIZED ${chToDate('created_at')}
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date_et)
ORDER BY (workspace_id, event_date_et, event_name)
`

let client: ClickHouseClient | null = null
let clickHouseBackoffUntil = 0
const CLICKHOUSE_BACKOFF_MS = 30_000

export function shouldSkipClickHouse(): boolean {
  return Date.now() < clickHouseBackoffUntil
}

export function noteClickHouseFailure(): void {
  clickHouseBackoffUntil = Date.now() + CLICKHOUSE_BACKOFF_MS
}

export function noteClickHouseSuccess(): void {
  clickHouseBackoffUntil = 0
}

function getEnv(name: string): string | undefined {
  const value = process.env[name]
  return value && value.length > 0 ? value : undefined
}

export function getClickHouseClient(): ClickHouseClient {
  if (client) return client

  const url = getEnv('CLICKHOUSE_URL')
  if (!url) {
    throw new Error(
      'CLICKHOUSE_URL is not configured. The api requires CLICKHOUSE_URL, CLICKHOUSE_USER, CLICKHOUSE_PASSWORD.',
    )
  }

  client = createClient({
    url,
    username: getEnv('CLICKHOUSE_USER') ?? 'default',
    password: getEnv('CLICKHOUSE_PASSWORD'),
    request_timeout: 60_000,
    clickhouse_settings: {
      async_insert: 1,
      wait_for_async_insert: 1,
    },
  })

  return client
}

export async function ensureEventsTable(): Promise<void> {
  const ch = getClickHouseClient()
  await migrateLegacyEventsTable(ch)
  await ch.command({ query: CREATE_EVENTS_SQL })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS lp_public_id LowCardinality(String) DEFAULT ''`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS variant LowCardinality(String) DEFAULT ''`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS utm_id LowCardinality(String) DEFAULT ''`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS utm_s1 LowCardinality(String) DEFAULT ''`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS state LowCardinality(String) DEFAULT ''`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS zipcode LowCardinality(String) DEFAULT ''`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS event_date_et Date MATERIALIZED ${chToDate('created_at')}`,
  })

  await ch.command({
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

  await ch.command({ query: 'DROP VIEW IF EXISTS daily_metrics_mv' })

  await ch.command({
    query: `
      CREATE MATERIALIZED VIEW IF NOT EXISTS daily_metrics_mv
      TO daily_metrics AS
      SELECT
          workspace_id,
          ${chToDate('created_at')} AS day,
          sum(if(event_name = 'page_view', 1, 0)) AS pageviews,
          uniqStateIf(user_id, event_name = 'page_view') AS visitors,
          uniqState(session_id) AS sessions,
          uniqStateIf(session_id, event_name IN ('button_click','link_click','form_start','scroll_depth')) AS interactions,
          uniqStateIf(session_id, event_name = 'form_start') AS form_started,
          uniqStateIf(session_id, event_name = 'form_success') AS form_submitted
      FROM ${CLICKHOUSE_EVENTS_TABLE}
      GROUP BY workspace_id, day
    `,
  })

  await rebuildDailyMetricsIfNeeded(ch)
}

const DAILY_METRICS_TZ_VERSION = 'america_new_york_v1'

async function rebuildDailyMetricsIfNeeded(ch: ClickHouseClient): Promise<void> {
  await ch.command({
    query: `
      CREATE TABLE IF NOT EXISTS arohaa_schema_meta (
        key String,
        value String
      ) ENGINE = ReplacingMergeTree()
      ORDER BY key
    `,
  })

  const versionRes = await ch.query({
    query: `
      SELECT value
      FROM arohaa_schema_meta FINAL
      WHERE key = 'daily_metrics_tz'
      LIMIT 1
    `,
    format: 'JSON',
  })
  const versionRows = (
    (await versionRes.json()) as { data: Array<{ value: string }> }
  ).data
  if (versionRows[0]?.value === DAILY_METRICS_TZ_VERSION) return

  await ch.command({ query: 'TRUNCATE TABLE IF EXISTS daily_metrics' })
  await ch.command({
    query: `
      INSERT INTO daily_metrics
      SELECT
          workspace_id,
          ${chToDate('created_at')} AS day,
          sum(if(event_name = 'page_view', 1, 0)) AS pageviews,
          uniqStateIf(user_id, event_name = 'page_view') AS visitors,
          uniqState(session_id) AS sessions,
          uniqStateIf(session_id, event_name IN ('button_click','link_click','form_start','scroll_depth')) AS interactions,
          uniqStateIf(session_id, event_name = 'form_start') AS form_started,
          uniqStateIf(session_id, event_name = 'form_success') AS form_submitted
      FROM ${CLICKHOUSE_EVENTS_TABLE}
      GROUP BY workspace_id, day
    `,
  })
  await ch.command({
    query: `
      INSERT INTO arohaa_schema_meta (key, value)
      VALUES ('daily_metrics_tz', {version:String})
    `,
    query_params: { version: DAILY_METRICS_TZ_VERSION },
  })
}

async function migrateLegacyEventsTable(ch: ClickHouseClient): Promise<void> {
  try {
    const result = await ch.query({
      query: `
        SELECT name
        FROM system.tables
        WHERE database = currentDatabase()
          AND name IN ('events', {target:String})
      `,
      query_params: { target: CLICKHOUSE_EVENTS_TABLE },
      format: 'JSON',
    })
    const json = (await result.json()) as { data: Array<{ name: string }> }
    const names = new Set(json.data.map((row) => row.name))
    if (names.has('events') && !names.has(CLICKHOUSE_EVENTS_TABLE)) {
      await ch.command({ query: `RENAME TABLE events TO ${CLICKHOUSE_EVENTS_TABLE}` })
    }
  } catch {
    // Best-effort migration for existing deployments.
  }
}

export async function pingClickHouse(timeoutMs: number = 3000): Promise<boolean> {
  try {
    const ch = getClickHouseClient()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const result = await ch.query({
        query: 'SELECT 1 AS ok',
        format: 'JSON',
        abort_signal: controller.signal,
      })
      const json = (await result.json()) as { data: Array<{ ok: number }> }
      return json.data?.[0]?.ok === 1
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return false
  }
}

export async function insertEvents(rows: EventRow[]): Promise<void> {
  if (rows.length === 0) return

  const ch = getClickHouseClient()
  try {
    await ch.insert({
      table: CLICKHOUSE_EVENTS_TABLE,
      values: rows,
      format: 'JSONEachRow',
    })
    noteClickHouseSuccess()
  } catch (err) {
    noteClickHouseFailure()
    throw err
  }
}

export async function closeClickHouseClient(): Promise<void> {
  if (!client) return
  const c = client
  client = null
  await c.close()
}
