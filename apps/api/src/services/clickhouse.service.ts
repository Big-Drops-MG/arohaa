import { createClient, type ClickHouseClient } from '@clickhouse/client'
import type { EventRow } from '../types/event.js'

const CREATE_EVENTS_SQL = `
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
ORDER BY (workspace_id, toDate(created_at), event_name)
`

let client: ClickHouseClient | null = null

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
    clickhouse_settings: {
      async_insert: 1,
      wait_for_async_insert: 1,
    },
  })

  return client
}

export async function ensureEventsTable(): Promise<void> {
  const ch = getClickHouseClient()
  await ch.command({ query: CREATE_EVENTS_SQL })
  await ch.command({
    query:
      "ALTER TABLE events ADD COLUMN IF NOT EXISTS lp_public_id LowCardinality(String) DEFAULT ''",
  })
}

export async function pingClickHouse(timeoutMs: number = 3000): Promise<boolean> {
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
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export async function insertEvents(rows: EventRow[]): Promise<void> {
  if (rows.length === 0) return

  const ch = getClickHouseClient()
  await ch.insert({
    table: 'events',
    values: rows,
    format: 'JSONEachRow',
  })
}

export async function closeClickHouseClient(): Promise<void> {
  if (!client) return
  const c = client
  client = null
  await c.close()
}
