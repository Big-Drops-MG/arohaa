import {
  readAnalyticsCache,
  writeAnalyticsCache,
} from '../lib/analytics-cache.js'
import {
  isUtmFilterDimension,
  type UtmFilterDimension,
} from '../lib/analytics-utm-filter.js'
import { getClickHouseClient } from './clickhouse.service.js'

type CHJson<T> = { data: T[] }

const UTM_DISCOVERED_CACHE_TTL_SEC = 600

const UTM_DISCOVERED_MAX_PER_KEY = 1_000

export type DiscoveredUtmParam = {
  key: string
  value: string
}

export async function getDiscoveredUtmParams(
  workspaceId: string,
): Promise<DiscoveredUtmParam[]> {
  const cacheKey = `analytics:utm-discovered:v3:${workspaceId}`
  const cached = await readAnalyticsCache<DiscoveredUtmParam[]>(cacheKey)
  if (cached) return cached

  const ch = getClickHouseClient()
  const res = await ch.query({
    format: 'JSON',
    query_params: {
      wid: workspaceId,
      per_key: UTM_DISCOVERED_MAX_PER_KEY,
    },
    query: `
      SELECT key, value
      FROM (
        SELECT
          'utm_source' AS key,
          utm_source AS value
        FROM events_raw
        WHERE workspace_id = {wid:UUID}
          AND utm_source != ''
          AND created_at >= now() - INTERVAL 90 DAY
        GROUP BY utm_source
        ORDER BY count() DESC, utm_source ASC
        LIMIT {per_key:UInt32}
      )
      UNION ALL
      SELECT key, value
      FROM (
        SELECT
          'utm_s1' AS key,
          utm_s1 AS value
        FROM events_raw
        WHERE workspace_id = {wid:UUID}
          AND utm_s1 != ''
          AND created_at >= now() - INTERVAL 90 DAY
        GROUP BY utm_s1
        ORDER BY count() DESC, utm_s1 ASC
        LIMIT {per_key:UInt32}
      )
      ORDER BY key ASC, value ASC
    `,
  })

  const rows = ((await res.json()) as CHJson<DiscoveredUtmParam>).data ?? []
  const result = rows.filter((row) => row.key && row.value)
  await writeAnalyticsCache(cacheKey, result, UTM_DISCOVERED_CACHE_TTL_SEC)
  return result
}

export async function getUtmDimensionValues(
  workspaceId: string,
  dimension: UtmFilterDimension,
): Promise<string[]> {
  if (!isUtmFilterDimension(dimension)) return []

  const ch = getClickHouseClient()
  const res = await ch.query({
    format: 'JSON',
    query_params: { wid: workspaceId },
    query: `
      SELECT value
      FROM (
        SELECT ${dimension} AS value
        FROM events_raw
        WHERE workspace_id = {wid:UUID}
          AND ${dimension} != ''
          AND created_at >= now() - INTERVAL 90 DAY
        GROUP BY ${dimension}
      )
      ORDER BY value ASC
    `,
  })

  const rows = ((await res.json()) as CHJson<{ value: string }>).data ?? []
  return rows.map((row) => row.value).filter(Boolean)
}
