import {
  isUtmFilterDimension,
  type UtmFilterDimension,
} from '../lib/analytics-utm-filter.js'
import { getClickHouseClient } from './clickhouse.service.js'

type CHJson<T> = { data: T[] }

export type DiscoveredUtmParam = {
  key: string
  value: string
}

export async function getDiscoveredUtmParams(
  workspaceId: string,
): Promise<DiscoveredUtmParam[]> {
  const ch = getClickHouseClient()
  const res = await ch.query({
    format: 'JSON',
    query_params: { wid: workspaceId },
    query: `
      SELECT key, value
      FROM (
        SELECT 'utm_source' AS key, utm_source AS value
        FROM events_raw
        WHERE workspace_id = {wid:UUID}
          AND utm_source != ''
          AND created_at >= now() - INTERVAL 90 DAY
        GROUP BY utm_source
        UNION ALL
        SELECT 'utm_s1' AS key, utm_s1 AS value
        FROM events_raw
        WHERE workspace_id = {wid:UUID}
          AND utm_s1 != ''
          AND created_at >= now() - INTERVAL 90 DAY
        GROUP BY utm_s1
      )
      ORDER BY key ASC, value ASC
    `,
  })

  const rows = ((await res.json()) as CHJson<DiscoveredUtmParam>).data ?? []
  return rows.filter((row) => row.key && row.value)
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
