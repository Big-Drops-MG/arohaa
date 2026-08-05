import { CLICKHOUSE_EVENTS_TABLE } from '../lib/clickhouse-events-table.js'
import { getClickHouseClient } from './clickhouse.service.js'
import { resolveSegmentClickHouseColumn } from './segment-compiler.service.js'

type CHJson<T> = { data: T[] }

const LOOKBACK_DAYS = 90
const VALUE_LIMIT = 500

/**
 * Distinct non-empty values for a segment property, ranked by frequency.
 * Column ids must resolve through COLUMN_MAP (never interpolate raw input).
 */
export async function getSegmentColumnValues(
  workspaceId: string,
  column: string,
): Promise<string[]> {
  const chColumn = resolveSegmentClickHouseColumn(column)
  if (!chColumn) {
    throw new Error(`Unsupported segment column: ${column}`)
  }

  const ch = getClickHouseClient()
  const res = await ch.query({
    format: 'JSON',
    query_params: { wid: workspaceId },
    query: `
      SELECT value
      FROM (
        SELECT ${chColumn} AS value, count() AS c
        FROM ${CLICKHOUSE_EVENTS_TABLE}
        WHERE workspace_id = {wid:UUID}
          AND ${chColumn} != ''
          AND created_at >= now() - INTERVAL ${LOOKBACK_DAYS} DAY
        GROUP BY ${chColumn}
        ORDER BY c DESC, value ASC
        LIMIT ${VALUE_LIMIT}
      )
      ORDER BY value ASC
    `,
  })

  const rows = ((await res.json()) as CHJson<{ value: string }>).data ?? []
  return rows.map((row) => row.value).filter((value) => Boolean(value?.trim()))
}
