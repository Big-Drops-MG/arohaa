import { createClient, type ClickHouseClient } from '@clickhouse/client'
import type { EventRow } from '../types/event.js'
import { CLICKHOUSE_EVENTS_TABLE } from '../lib/clickhouse-events-table.js'
import { chToDate } from '../lib/analytics-timezone.js'

const CREATE_EVENTS_SQL = `
CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_EVENTS_TABLE} (
    event_id String DEFAULT '',
    event_name LowCardinality(String),
    workspace_id UUID,
    tenant_workspace_id String DEFAULT '',
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
    formtype LowCardinality(String) DEFAULT '',
    country LowCardinality(String) DEFAULT 'Unknown',
    country_code LowCardinality(String) DEFAULT '',
    city LowCardinality(String) DEFAULT '',
    state LowCardinality(String) DEFAULT '',
    zipcode LowCardinality(String) DEFAULT '',
    geo_zipcode LowCardinality(String) DEFAULT '',
    form_zip_entered LowCardinality(String) DEFAULT '',
    client_ip String DEFAULT '',
    client_ip_hash String DEFAULT '',
    phone_hash String DEFAULT '',
    email_hash String DEFAULT '',
    state_code LowCardinality(String) DEFAULT '',
    latitude Float64 DEFAULT 0,
    longitude Float64 DEFAULT 0,
    geo_accuracy UInt16 DEFAULT 0,
    network_class LowCardinality(String) DEFAULT '',
    network_asn UInt32 DEFAULT 0,
    network_org String DEFAULT '',
    network_evidence_source LowCardinality(String) DEFAULT '',
    network_evidence_as_of LowCardinality(String) DEFAULT '',
    metric_name LowCardinality(String) DEFAULT '',
    metric_value Float64 DEFAULT 0,
    properties String,
    trace_id String DEFAULT '',
    created_at DateTime64(3, 'UTC') DEFAULT now64(3, 'UTC'),
    sdk_version LowCardinality(String) DEFAULT '',
    sdk_capabilities String DEFAULT '',
    event_seq UInt32 DEFAULT 0,
    batch_id String DEFAULT '',
    retry_id String DEFAULT '',
    client_ts Int64 DEFAULT 0,
    integrity_json String DEFAULT '',
    event_date_et Date MATERIALIZED ${chToDate('created_at')}
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date_et)
ORDER BY (workspace_id, event_date_et, event_name)
TTL toDateTime(created_at) + toIntervalDay(180)
`

let client: ClickHouseClient | null = null
let analyticsClient: ClickHouseClient | null = null
let pingClient: ClickHouseClient | null = null
let clickHouseBackoffUntil = 0
const CLICKHOUSE_BACKOFF_MS = 30_000
const ANALYTICS_MAX_OPEN_CONNECTIONS = 32


const ANALYTICS_QUERY_SETTINGS = {
  max_threads: 4,
  max_execution_time: 20,
  max_bytes_to_read: 20_000_000_000,
  use_query_cache: 1,
  query_cache_ttl: 60,
  query_cache_nondeterministic_function_handling: 'ignore',
} as const

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

function requireClickHouseUrl(): string {
  const url = getEnv('CLICKHOUSE_URL')
  if (!url) {
    throw new Error(
      'CLICKHOUSE_URL is not configured. The api requires CLICKHOUSE_URL, CLICKHOUSE_USER, CLICKHOUSE_PASSWORD.',
    )
  }
  return url
}

function createClickHouseClient(options: {
  max_open_connections: number
  request_timeout: number
  clickhouse_settings?: Record<string, string | number>
}): ClickHouseClient {
  return createClient({
    url: requireClickHouseUrl(),
    username: getEnv('CLICKHOUSE_USER') ?? 'default',
    password: getEnv('CLICKHOUSE_PASSWORD'),
    max_open_connections: options.max_open_connections,
    request_timeout: options.request_timeout,
    clickhouse_settings: options.clickhouse_settings,
  })
}

export function getClickHouseClient(): ClickHouseClient {
  if (client) return client

  client = createClickHouseClient({
    max_open_connections: ANALYTICS_MAX_OPEN_CONNECTIONS,
    request_timeout: 60_000,
    clickhouse_settings: {
      async_insert: 1,
      wait_for_async_insert: 1,
    },
  })

  return client
}

export function getAnalyticsClickHouseClient(): ClickHouseClient {
  if (analyticsClient) return analyticsClient

  analyticsClient = createClickHouseClient({
    max_open_connections: ANALYTICS_MAX_OPEN_CONNECTIONS,
    request_timeout: 30_000,
    clickhouse_settings: { ...ANALYTICS_QUERY_SETTINGS },
  })

  return analyticsClient
}

function getClickHousePingClient(): ClickHouseClient {
  if (pingClient) return pingClient

  pingClient = createClickHouseClient({
    max_open_connections: 2,
    request_timeout: 5_000,
  })

  return pingClient
}

export async function ensureEventsTable(): Promise<void> {
  const ch = getClickHouseClient()
  await migrateLegacyEventsTable(ch)
  await ch.command({ query: CREATE_EVENTS_SQL })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS event_id String DEFAULT ''`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS tenant_workspace_id String DEFAULT ''`,
  })
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
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS formtype LowCardinality(String) DEFAULT ''`,
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
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS geo_zipcode LowCardinality(String) DEFAULT ''`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS client_ip_hash String DEFAULT ''`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS client_ip String DEFAULT ''`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS form_zip_entered LowCardinality(String) DEFAULT ''`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS phone_hash String DEFAULT ''`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS email_hash String DEFAULT ''`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS country_code LowCardinality(String) DEFAULT ''`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS network_class LowCardinality(String) DEFAULT ''`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS network_asn UInt32 DEFAULT 0`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS network_org String DEFAULT ''`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS network_evidence_source LowCardinality(String) DEFAULT ''`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS network_evidence_as_of LowCardinality(String) DEFAULT ''`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS state_code LowCardinality(String) DEFAULT ''`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS latitude Float64 DEFAULT 0`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS longitude Float64 DEFAULT 0`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS geo_accuracy UInt16 DEFAULT 0`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS event_date_et Date MATERIALIZED ${chToDate('created_at')}`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS sdk_version LowCardinality(String) DEFAULT ''`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS sdk_capabilities String DEFAULT ''`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS event_seq UInt32 DEFAULT 0`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS batch_id String DEFAULT ''`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS retry_id String DEFAULT ''`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS client_ts Int64 DEFAULT 0`,
  })
  await ch.command({
    query:
      `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS integrity_json String DEFAULT ''`,
  })
  await ch.command({
    query: `ALTER TABLE ${CLICKHOUSE_EVENTS_TABLE} MODIFY TTL toDateTime(created_at) + toIntervalDay(180)`,
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

  await ch.command({
    query: `ALTER TABLE daily_metrics ADD COLUMN IF NOT EXISTS zip_submitted AggregateFunction(uniq, String)`,
  })
  await ch.command({
    query: `ALTER TABLE daily_metrics ADD COLUMN IF NOT EXISTS service_clicks AggregateFunction(uniq, String)`,
  })

  await ch.command({ query: 'DROP VIEW IF EXISTS daily_metrics_mv' })

  await ch.command({
    query: `
      CREATE MATERIALIZED VIEW IF NOT EXISTS daily_metrics_mv
      TO daily_metrics AS
      ${DAILY_METRICS_SELECT_SQL}
    `,
  })

  await ensureSchemaMetaTable(ch)
  await ensureSessionRollup(ch)
  await ensureHeatmapSchema(ch)
  await ensureLeadRiskTable(ch)
  await ensureLeadContactKeysTable(ch)
  await ensureSessionSkipIndexes(ch)
  await ensureLeadReviewTable(ch)
  await ensureLeadReviewAuditTable(ch)
  await ensureVisitRiskTable(ch)
  await ensurePageIntegrityBaselineTable(ch)
  await rebuildDailyMetricsIfNeeded(ch)
}

export const LEAD_RISK_TABLE = 'lead_risk'
export const VISIT_RISK_TABLE = 'visit_risk'

async function ensureVisitRiskTable(ch: ClickHouseClient): Promise<void> {
  await ch.command({
    query: `
      CREATE TABLE IF NOT EXISTS ${VISIT_RISK_TABLE} (
          workspace_id UUID,
          session_id String,
          tenant_workspace_id String DEFAULT '',
          suspicious UInt8 DEFAULT 0,
          coverage LowCardinality(String) DEFAULT '',
          findings_json String DEFAULT '',
          reasons Array(String),
          shadow_score Nullable(UInt8),
          shadow_delta UInt16 DEFAULT 0,
          model_version LowCardinality(String),
          scored_at DateTime64(3, 'UTC') DEFAULT now64(3, 'UTC'),
          sdk_version LowCardinality(String) DEFAULT '',
          sdk_capabilities String DEFAULT ''
      ) ENGINE = ReplacingMergeTree(scored_at)
      ORDER BY (workspace_id, session_id)
    `,
  })
}

export const PAGE_INTEGRITY_BASELINE_TABLE = 'page_integrity_baseline'

async function ensurePageIntegrityBaselineTable(
  ch: ClickHouseClient,
): Promise<void> {
  await ch.command({
    query: `
      CREATE TABLE IF NOT EXISTS ${PAGE_INTEGRITY_BASELINE_TABLE} (
          landing_page_id String,
          version UInt32,
          status LowCardinality(String) DEFAULT 'draft',
          script_origins Array(String),
          form_actions Array(String),
          iframe_origins Array(String),
          approved_at DateTime64(3, 'UTC') DEFAULT toDateTime64(0, 3, 'UTC'),
          approved_by String DEFAULT '',
          updated_at DateTime64(3, 'UTC') DEFAULT now64(3, 'UTC')
      ) ENGINE = ReplacingMergeTree(updated_at)
      ORDER BY (landing_page_id, version)
    `,
  })
}

async function ensureLeadRiskTable(ch: ClickHouseClient): Promise<void> {
  await ch.command({
    query: `
      CREATE TABLE IF NOT EXISTS ${LEAD_RISK_TABLE} (
          workspace_id UUID,
          session_id String,
          score UInt8,
          label LowCardinality(String),
          reasons Array(String),
          features_json String DEFAULT '',
          model_version LowCardinality(String),
          scored_at DateTime64(3, 'UTC') DEFAULT now64(3, 'UTC'),
          override_label LowCardinality(String) DEFAULT '',
          override_by String DEFAULT '',
          override_at DateTime64(3, 'UTC') DEFAULT toDateTime64(0, 3, 'UTC'),
          override_note String DEFAULT '',
          coverage LowCardinality(String) DEFAULT '',
          findings_json String DEFAULT '',
          tenant_workspace_id String DEFAULT '',
          phone_hash String DEFAULT '',
          email_hash String DEFAULT ''
      ) ENGINE = ReplacingMergeTree(scored_at)
      ORDER BY (workspace_id, session_id)
    `,
  })
  for (const col of [
    `ALTER TABLE ${LEAD_RISK_TABLE} ADD COLUMN IF NOT EXISTS coverage LowCardinality(String) DEFAULT ''`,
    `ALTER TABLE ${LEAD_RISK_TABLE} ADD COLUMN IF NOT EXISTS findings_json String DEFAULT ''`,
    `ALTER TABLE ${LEAD_RISK_TABLE} ADD COLUMN IF NOT EXISTS tenant_workspace_id String DEFAULT ''`,
    `ALTER TABLE ${LEAD_RISK_TABLE} ADD COLUMN IF NOT EXISTS phone_hash String DEFAULT ''`,
    `ALTER TABLE ${LEAD_RISK_TABLE} ADD COLUMN IF NOT EXISTS email_hash String DEFAULT ''`,
  ]) {
    await ch.command({ query: col })
  }
}

export const LEAD_CONTACT_KEYS_TABLE = 'lead_contact_keys'
export const LEAD_REVIEW_TABLE = 'lead_review'
export const LEAD_REVIEW_AUDIT_TABLE = 'lead_review_audit'

async function ensureLeadContactKeysTable(ch: ClickHouseClient): Promise<void> {
  const desiredOrder =
    '(tenant_workspace_id, key_type, key_hash, landing_page_id, session_id, event_id)'
  await ch.command({
    query: `
      CREATE TABLE IF NOT EXISTS ${LEAD_CONTACT_KEYS_TABLE} (
          tenant_workspace_id String,
          key_type LowCardinality(String),
          key_hash String,
          landing_page_id String,
          session_id String,
          event_id String DEFAULT '',
          utm_source String DEFAULT '',
          utm_s1 String DEFAULT '',
          utm_campaign String DEFAULT '',
          submitted_at DateTime64(3, 'UTC') DEFAULT now64(3, 'UTC'),
          first_name String DEFAULT '',
          last_name String DEFAULT '',
          email_masked String DEFAULT '',
          zip String DEFAULT '',
          norm_version LowCardinality(String) DEFAULT ''
      ) ENGINE = ReplacingMergeTree(submitted_at)
      ORDER BY ${desiredOrder}
    `,
  })
  try {
    const res = await ch.query({
      format: 'JSON',
      query: `
        SELECT sorting_key
        FROM system.tables
        WHERE database = currentDatabase()
          AND name = '${LEAD_CONTACT_KEYS_TABLE}'
        LIMIT 1
      `,
    })
    const sortingKey = String(
      ((await res.json()) as { data?: Array<{ sorting_key?: string }> }).data?.[0]
        ?.sorting_key || '',
    )
    if (sortingKey && !sortingKey.includes('event_id')) {
      const migrated = `${LEAD_CONTACT_KEYS_TABLE}_by_event`
      await ch.command({
        query: `
          CREATE TABLE IF NOT EXISTS ${migrated} (
              tenant_workspace_id String,
              key_type LowCardinality(String),
              key_hash String,
              landing_page_id String,
              session_id String,
              event_id String DEFAULT '',
              utm_source String DEFAULT '',
              utm_s1 String DEFAULT '',
              utm_campaign String DEFAULT '',
              submitted_at DateTime64(3, 'UTC') DEFAULT now64(3, 'UTC'),
              first_name String DEFAULT '',
              last_name String DEFAULT '',
              email_masked String DEFAULT '',
              zip String DEFAULT '',
              norm_version LowCardinality(String) DEFAULT ''
          ) ENGINE = ReplacingMergeTree(submitted_at)
          ORDER BY ${desiredOrder}
        `,
      })
      await ch.command({
        query: `
          INSERT INTO ${migrated}
          SELECT
            tenant_workspace_id, key_type, key_hash, landing_page_id, session_id,
            if(event_id = '', concat('legacy:', toString(submitted_at)), event_id) AS event_id,
            utm_source, utm_s1, utm_campaign, submitted_at,
            first_name, last_name, email_masked, zip, norm_version
          FROM ${LEAD_CONTACT_KEYS_TABLE}
        `,
      })
      await ch.command({
        query: `EXCHANGE TABLES ${LEAD_CONTACT_KEYS_TABLE} AND ${migrated}`,
      })
      await ch.command({ query: `DROP TABLE IF EXISTS ${migrated}` })
    }
  } catch (err) {
    console.error('[clickhouse] lead_contact_keys event_id order migrate skipped', err)
  }
}

async function ensureLeadReviewTable(ch: ClickHouseClient): Promise<void> {
  await ch.command({
    query: `
      CREATE TABLE IF NOT EXISTS ${LEAD_REVIEW_TABLE} (
          tenant_workspace_id String,
          workspace_id UUID,
          session_id String,
          review_status LowCardinality(String) DEFAULT 'unreviewed',
          decision LowCardinality(String) DEFAULT '',
          decision_note String DEFAULT '',
          decision_by String DEFAULT '',
          decision_at DateTime64(3, 'UTC') DEFAULT toDateTime64(0, 3, 'UTC'),
          call_outcome LowCardinality(String) DEFAULT '',
          call_outcome_by String DEFAULT '',
          call_outcome_at DateTime64(3, 'UTC') DEFAULT toDateTime64(0, 3, 'UTC'),
          assessment_snapshot String DEFAULT '',
          history_json String DEFAULT '[]',
          revision UInt32 DEFAULT 1,
          updated_at DateTime64(3, 'UTC') DEFAULT now64(3, 'UTC')
      ) ENGINE = ReplacingMergeTree(updated_at)
      ORDER BY (tenant_workspace_id, workspace_id, session_id)
    `,
  })
  await ch.command({
    query: `ALTER TABLE ${LEAD_REVIEW_TABLE} ADD COLUMN IF NOT EXISTS history_json String DEFAULT '[]'`,
  })
}

async function ensureLeadReviewAuditTable(ch: ClickHouseClient): Promise<void> {
  await ch.command({
    query: `
      CREATE TABLE IF NOT EXISTS ${LEAD_REVIEW_AUDIT_TABLE} (
          tenant_workspace_id String,
          workspace_id UUID,
          session_id String,
          revision UInt32,
          review_status LowCardinality(String) DEFAULT '',
          decision LowCardinality(String) DEFAULT '',
          decision_note String DEFAULT '',
          decision_by String DEFAULT '',
          decision_at DateTime64(3, 'UTC') DEFAULT toDateTime64(0, 3, 'UTC'),
          call_outcome LowCardinality(String) DEFAULT '',
          call_outcome_by String DEFAULT '',
          call_outcome_at DateTime64(3, 'UTC') DEFAULT toDateTime64(0, 3, 'UTC'),
          assessment_snapshot String DEFAULT '',
          recorded_at DateTime64(3, 'UTC') DEFAULT now64(3, 'UTC')
      ) ENGINE = MergeTree()
      ORDER BY (tenant_workspace_id, workspace_id, session_id, revision, recorded_at)
    `,
  })
}

const HEATMAP_EVENTS_TABLE = 'heatmap_events'

async function ensureHeatmapSchema(ch: ClickHouseClient): Promise<void> {
  await ch.command({
    query: `
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
          properties String DEFAULT '',
          utm_source LowCardinality(String) DEFAULT '',
          utm_s1 LowCardinality(String) DEFAULT ''
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMM(timestamp)
      ORDER BY (workspace_id, page_url, event_type, timestamp)
      TTL toDateTime(timestamp) + toIntervalDay(180)
    `,
  })
  await ch.command({
    query: `ALTER TABLE ${HEATMAP_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS device LowCardinality(String) DEFAULT ''`,
  })
  await ch.command({
    query: `ALTER TABLE ${HEATMAP_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS utm_source LowCardinality(String) DEFAULT ''`,
  })
  await ch.command({
    query: `ALTER TABLE ${HEATMAP_EVENTS_TABLE} ADD COLUMN IF NOT EXISTS utm_s1 LowCardinality(String) DEFAULT ''`,
  })
  await ch.command({
    query: `ALTER TABLE ${HEATMAP_EVENTS_TABLE} MODIFY TTL toDateTime(timestamp) + toIntervalDay(180)`,
  })

  for (const legacyView of [
    'heatmap_clicks_mv',
    'heatmap_mousemove_mv',
    'heatmap_scroll_mv',
    'heatmap_section_mv',
  ]) {
    await ch.command({ query: `DROP VIEW IF EXISTS ${legacyView}` })
  }

  await ensureHeatmapPointRollup(ch)
}

export const HEATMAP_POINT_ROLLUP_TABLE = 'heatmap_point_rollup'
const HEATMAP_POINT_ROLLUP_BACKFILL_KEY = 'heatmap_point_rollup_backfill'

export const HEATMAP_ROLLUP_DEVICE_SQL = `
  multiIf(
    device IN ('mobile', 'tablet', 'desktop'), device,
    viewport_width > 0 AND viewport_width < 768, 'mobile',
    viewport_width >= 768 AND viewport_width < 1024, 'tablet',
    'desktop'
  )`
export const HEATMAP_ROLLUP_PAGE_KEY_SQL = `replaceRegexpOne(page_url, '\\\\?[^#]*', '')`

const HEATMAP_POINT_ROLLUP_SELECT_SQL = (extraWhere: string) => `
      WITH
        if(JSONHas(properties, 'x'), JSONExtractFloat(properties, 'x'), x) AS ex,
        if(JSONHas(properties, 'y'), JSONExtractFloat(properties, 'y'), y) AS ey
      SELECT
          workspace_id,
          ${HEATMAP_ROLLUP_PAGE_KEY_SQL} AS page_key,
          ${HEATMAP_ROLLUP_DEVICE_SQL} AS device,
          utm_source,
          utm_s1,
          ${chToDate('timestamp')} AS day,
          event_type,
          element_selector AS selector,
          ifNull(nullIf(JSONExtractString(properties, 'fieldName'), ''), '') AS field_name,
          multiIf(
            event_type = 'mousemove', round(x, 2),
            event_type IN ('scroll', 'section'), 0.,
            element_selector = '', round(x, 2),
            round(ex, 1)
          ) AS gx,
          multiIf(
            event_type = 'mousemove', round(y, 2),
            event_type = 'scroll', toFloat64(toInt32(floor(least(greatest(y, 0.), 0.9999) * 10.) * 10)),
            event_type = 'section', 0.,
            element_selector = '', round(y, 2),
            round(ey, 1)
          ) AS gy,
          count() AS value,
          sum(x) AS sum_x,
          sum(y) AS sum_y,
          sum(ex) AS sum_ex,
          sum(ey) AS sum_ey,
          sumIf(JSONExtractFloat(properties, 'dwell_ms'), event_type = 'section') AS dwell_ms,
          min(timestamp) AS first_at
      FROM ${HEATMAP_EVENTS_TABLE}
      ${extraWhere}
      GROUP BY workspace_id, page_key, device, utm_source, utm_s1, day, event_type, selector, field_name, gx, gy
`


async function ensureHeatmapPointRollup(ch: ClickHouseClient): Promise<void> {
  await ch.command({
    query: `
      CREATE TABLE IF NOT EXISTS ${HEATMAP_POINT_ROLLUP_TABLE} (
          workspace_id UUID,
          page_key String,
          device LowCardinality(String),
          utm_source LowCardinality(String),
          utm_s1 LowCardinality(String),
          day Date,
          event_type LowCardinality(String),
          selector String,
          field_name String,
          gx Float64,
          gy Float64,
          value SimpleAggregateFunction(sum, UInt64),
          sum_x SimpleAggregateFunction(sum, Float64),
          sum_y SimpleAggregateFunction(sum, Float64),
          sum_ex SimpleAggregateFunction(sum, Float64),
          sum_ey SimpleAggregateFunction(sum, Float64),
          dwell_ms SimpleAggregateFunction(sum, Float64),
          first_at SimpleAggregateFunction(min, DateTime64(3))
      ) ENGINE = AggregatingMergeTree()
      PARTITION BY toYYYYMM(day)
      ORDER BY (workspace_id, page_key, event_type, day, device, utm_source, utm_s1, selector, field_name, gx, gy)
      TTL day + toIntervalDay(180)
    `,
  })

  const existing = await ch.query({
    query: `
      SELECT value
      FROM arohaa_schema_meta FINAL
      WHERE key = {key:String}
      LIMIT 1
    `,
    query_params: { key: HEATMAP_POINT_ROLLUP_BACKFILL_KEY },
    format: 'JSON',
  })
  const alreadyBackfilled =
    ((await existing.json()) as { data: Array<{ value: string }> }).data.length > 0

  await ch.command({
    query: `
      CREATE MATERIALIZED VIEW IF NOT EXISTS ${HEATMAP_POINT_ROLLUP_TABLE}_mv
      TO ${HEATMAP_POINT_ROLLUP_TABLE} AS
      ${HEATMAP_POINT_ROLLUP_SELECT_SQL('')}
    `,
  })

  if (alreadyBackfilled) return

  const cutoffRes = await ch.query({
    query: `SELECT formatDateTime(now64(3, 'UTC'), '%Y-%m-%d %H:%i:%S.%f', 'UTC') AS cutoff`,
    format: 'JSON',
  })
  const cutoff = ((await cutoffRes.json()) as { data: Array<{ cutoff: string }> }).data[0]?.cutoff
  if (!cutoff) return

  await ch.command({
    query: `
      INSERT INTO arohaa_schema_meta (key, value)
      VALUES ({key:String}, {cutoff:String})
    `,
    query_params: { key: HEATMAP_POINT_ROLLUP_BACKFILL_KEY, cutoff },
  })

  void ch
    .command({
      query: `
        INSERT INTO ${HEATMAP_POINT_ROLLUP_TABLE}
        ${HEATMAP_POINT_ROLLUP_SELECT_SQL(`WHERE timestamp < toDateTime64({cutoff:String}, 3, 'UTC')`)}
      `,
      query_params: { cutoff },
      clickhouse_settings: { max_execution_time: 1800 },
    })
    .catch(async (err: unknown) => {
      console.error('[clickhouse] heatmap_point_rollup backfill failed; will retry on next boot', err)
      await ch
        .command({
          query: `ALTER TABLE arohaa_schema_meta DELETE WHERE key = {key:String}`,
          query_params: { key: HEATMAP_POINT_ROLLUP_BACKFILL_KEY },
        })
        .catch(() => undefined)
    })
}

const DAILY_METRICS_TZ_VERSION = 'america_new_york_v2_submissions'

const DAILY_METRICS_SELECT_SQL = `
      SELECT
          workspace_id,
          ${chToDate('created_at')} AS day,
          sum(if(event_name = 'page_view', 1, 0)) AS pageviews,
          uniqStateIf(user_id, event_name = 'page_view') AS visitors,
          uniqState(session_id) AS sessions,
          uniqStateIf(session_id, event_name IN ('button_click','link_click','form_start','scroll_depth','service_click')) AS interactions,
          uniqStateIf(session_id, event_name = 'form_start') AS form_started,
          uniqStateIf(session_id, event_name = 'form_success') AS form_submitted,
          uniqStateIf(session_id, event_name IN ('zip_submit', 'form_success')) AS zip_submitted,
          uniqStateIf(session_id, event_name = 'service_click') AS service_clicks
      FROM ${CLICKHOUSE_EVENTS_TABLE}
      GROUP BY workspace_id, day
`

export const SESSION_ROLLUP_TABLE = 'session_rollup'
const SESSION_ROLLUP_BACKFILL_KEY = 'session_rollup_backfill'

const SESSION_ROLLUP_SELECT_SQL = (extraWhere: string) => `
      SELECT
          workspace_id,
          session_id,
          any(user_id) AS user_id,
          any(utm_source) AS utm_source,
          any(utm_s1) AS utm_s1,
          min(created_at) AS first_at,
          max(created_at) AS last_at,
          count() AS events,
          countIf(event_name = 'page_view') AS page_views,
          max(event_name = 'form_start') AS form_start,
          max(event_name = 'form_success') AS form_success,
          max(event_name = 'zip_submit') AS zip_submit,
          max(event_name = 'service_click') AS service_click,
          max(event_name IN ('button_click','link_click','form_start','scroll_depth','service_click')) AS interaction
      FROM ${CLICKHOUSE_EVENTS_TABLE}
      ${extraWhere}
      GROUP BY workspace_id, session_id
`


async function ensureSessionRollup(ch: ClickHouseClient): Promise<void> {
  await ch.command({
    query: `
      CREATE TABLE IF NOT EXISTS ${SESSION_ROLLUP_TABLE} (
          workspace_id UUID,
          session_id String,
          user_id SimpleAggregateFunction(any, String),
          utm_source SimpleAggregateFunction(any, String),
          utm_s1 SimpleAggregateFunction(any, String),
          first_at SimpleAggregateFunction(min, DateTime64(3, 'UTC')),
          last_at SimpleAggregateFunction(max, DateTime64(3, 'UTC')),
          events SimpleAggregateFunction(sum, UInt64),
          page_views SimpleAggregateFunction(sum, UInt64),
          form_start SimpleAggregateFunction(max, UInt8),
          form_success SimpleAggregateFunction(max, UInt8),
          zip_submit SimpleAggregateFunction(max, UInt8),
          service_click SimpleAggregateFunction(max, UInt8),
          interaction SimpleAggregateFunction(max, UInt8)
      ) ENGINE = AggregatingMergeTree()
      ORDER BY (workspace_id, session_id)
      TTL toDateTime(last_at) + toIntervalDay(180)
    `,
  })

  const existing = await ch.query({
    query: `
      SELECT value
      FROM arohaa_schema_meta FINAL
      WHERE key = {key:String}
      LIMIT 1
    `,
    query_params: { key: SESSION_ROLLUP_BACKFILL_KEY },
    format: 'JSON',
  })
  const rows = ((await existing.json()) as { data: Array<{ value: string }> }).data
  const alreadyBackfilled = rows.length > 0

  await ch.command({
    query: `
      CREATE MATERIALIZED VIEW IF NOT EXISTS ${SESSION_ROLLUP_TABLE}_mv
      TO ${SESSION_ROLLUP_TABLE} AS
      ${SESSION_ROLLUP_SELECT_SQL('')}
    `,
  })

  if (alreadyBackfilled) return

  const cutoffRes = await ch.query({
    query: `SELECT formatDateTime(now64(3, 'UTC'), '%Y-%m-%d %H:%i:%S.%f', 'UTC') AS cutoff`,
    format: 'JSON',
  })
  const cutoff = ((await cutoffRes.json()) as { data: Array<{ cutoff: string }> }).data[0]?.cutoff
  if (!cutoff) return

  await ch.command({
    query: `
      INSERT INTO arohaa_schema_meta (key, value)
      VALUES ({key:String}, {cutoff:String})
    `,
    query_params: { key: SESSION_ROLLUP_BACKFILL_KEY, cutoff },
  })

  void ch
    .command({
      query: `
        INSERT INTO ${SESSION_ROLLUP_TABLE}
        ${SESSION_ROLLUP_SELECT_SQL(`WHERE created_at < toDateTime64({cutoff:String}, 3, 'UTC')`)}
      `,
      query_params: { cutoff },
      clickhouse_settings: { max_execution_time: 1800 },
    })
    .catch(async (err: unknown) => {
      console.error('[clickhouse] session_rollup backfill failed; will retry on next boot', err)
      await ch
        .command({
          query: `ALTER TABLE arohaa_schema_meta DELETE WHERE key = {key:String}`,
          query_params: { key: SESSION_ROLLUP_BACKFILL_KEY },
        })
        .catch(() => undefined)
    })
}

async function ensureSchemaMetaTable(ch: ClickHouseClient): Promise<void> {
  await ch.command({
    query: `
      CREATE TABLE IF NOT EXISTS arohaa_schema_meta (
        key String,
        value String
      ) ENGINE = ReplacingMergeTree()
      ORDER BY key
    `,
  })
}

async function readSchemaMeta(ch: ClickHouseClient, key: string): Promise<string | null> {
  const res = await ch.query({
    query: `SELECT value FROM arohaa_schema_meta FINAL WHERE key = {key:String} LIMIT 1`,
    query_params: { key },
    format: 'JSON',
  })
  const rows = ((await res.json()) as { data: Array<{ value: string }> }).data
  return rows[0]?.value ?? null
}

async function writeSchemaMeta(ch: ClickHouseClient, key: string, value: string): Promise<void> {
  await ch.command({
    query: `INSERT INTO arohaa_schema_meta (key, value) VALUES ({key:String}, {value:String})`,
    query_params: { key, value },
  })
}

const SESSION_SKIP_INDEX_KEY = 'session_skip_index'
const SESSION_SKIP_INDEX_VERSION = 'v1'

async function ensureSessionSkipIndexes(ch: ClickHouseClient): Promise<void> {
  const targets = [CLICKHOUSE_EVENTS_TABLE, LEAD_CONTACT_KEYS_TABLE]
  for (const table of targets) {
    await ch.command({
      query: `ALTER TABLE ${table} ADD INDEX IF NOT EXISTS idx_session_id session_id TYPE bloom_filter(0.01) GRANULARITY 1`,
    })
  }

  if ((await readSchemaMeta(ch, SESSION_SKIP_INDEX_KEY)) === SESSION_SKIP_INDEX_VERSION) return
  await writeSchemaMeta(ch, SESSION_SKIP_INDEX_KEY, SESSION_SKIP_INDEX_VERSION)

  void (async () => {
    try {
      for (const table of targets) {
        await ch.command({
          query: `ALTER TABLE ${table} MATERIALIZE INDEX idx_session_id`,
          clickhouse_settings: { mutations_sync: '0' },
        })
      }
    } catch (err) {
      console.error('[clickhouse] session skip index materialize failed; will retry on next boot', err)
      await ch
        .command({
          query: `ALTER TABLE arohaa_schema_meta DELETE WHERE key = {key:String}`,
          query_params: { key: SESSION_SKIP_INDEX_KEY },
        })
        .catch(() => undefined)
    }
  })()
}

async function rebuildDailyMetricsIfNeeded(ch: ClickHouseClient): Promise<void> {
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
      ${DAILY_METRICS_SELECT_SQL}
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

export type ClickHouseProbeStatus = 'ok' | 'unauthorized' | 'unreachable'

export function isClickHouseAuthError(err: unknown): boolean {
  const text = [
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message?: unknown }).message ?? '')
      : '',
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : '',
    String(err ?? ''),
  ]
    .join(' ')
    .toLowerCase()

  return (
    text.includes('authentication failed') ||
    text.includes('authentication_failed') ||
    text.includes('wrong password') ||
    text.includes('unauthorized') ||
    text.includes('code: 516') ||
    text.includes('http 401') ||
    text.includes(' status code: 401') ||
    text.includes('statuscode: 401')
  )
}

export async function probeClickHouse(
  timeoutMs: number = 3000,
): Promise<ClickHouseProbeStatus> {
  try {
    const ch = getClickHousePingClient()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const result = await ch.query({
        query: 'SELECT 1 AS ok',
        format: 'JSON',
        abort_signal: controller.signal,
        clickhouse_settings: {
          max_threads: 1,
          max_execution_time: Math.max(1, Math.ceil(timeoutMs / 1000)),
        },
      })
      const json = (await result.json()) as { data: Array<{ ok: number }> }
      return json.data?.[0]?.ok === 1 ? 'ok' : 'unreachable'
    } finally {
      clearTimeout(timer)
    }
  } catch (err) {
    return isClickHouseAuthError(err) ? 'unauthorized' : 'unreachable'
  }
}

export async function pingClickHouse(timeoutMs: number = 3000): Promise<boolean> {
  return (await probeClickHouse(timeoutMs)) === 'ok'
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
  const main = client
  const analytics = analyticsClient
  const ping = pingClient
  client = null
  analyticsClient = null
  pingClient = null
  await Promise.all([
    main ? main.close() : Promise.resolve(),
    analytics ? analytics.close() : Promise.resolve(),
    ping ? ping.close() : Promise.resolve(),
  ])
}
