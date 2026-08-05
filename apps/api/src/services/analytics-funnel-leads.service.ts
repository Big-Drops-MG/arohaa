import { getClickHouseClient } from './clickhouse.service.js'
import {
  rangeFilter,
  rangeQueryParams,
  resolveAnalyticsWindow,
  type AnalyticsCustomRange,
  type AnalyticsRangeId,
} from '../lib/analytics-range.js'
import {
  fieldsWithoutReserved,
  normalizeLeadFields,
  pickLeadEmail,
  pickLeadZip,
} from '../lib/lead-fields.js'

type CHJson<T> = { data: T[] }

export type FunnelLeadRow = {
  sessionId: string
  createdAt: string
  zip: string
  email: string
  fields: Record<string, string>
}

export type FunnelLeadsResponse = {
  rangeId: AnalyticsRangeId
  leads: FunnelLeadRow[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

function parseFields(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const props = parsed as Record<string, unknown>
    const source =
      props.fields && typeof props.fields === 'object' && !Array.isArray(props.fields)
        ? (props.fields as Record<string, unknown>)
        : props
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(source)) {
      if (k === 'fields' || k === '_k') continue
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        out[k] = String(v)
      }
    }
    return normalizeLeadFields(out)
  } catch {
    return {}
  }
}

export async function getFunnelLeads({
  workspaceId,
  rangeId,
  custom,
  limit = 15,
  offset = 0,
}: {
  workspaceId: string
  rangeId: AnalyticsRangeId
  custom?: AnalyticsCustomRange
  limit?: number
  offset?: number
}): Promise<FunnelLeadsResponse> {
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit) || 15))
  const safeOffset = Math.max(0, Math.floor(offset) || 0)
  const window = resolveAnalyticsWindow(rangeId, new Date(), custom)
  const ch = getClickHouseClient()
  const where = `${rangeFilter()}
    AND event_name IN ('form_success', 'form_step_complete', 'form_step_view')
    AND positionCaseInsensitive(properties, '"fields"') > 0`

  const p = {
    wid: workspaceId,
    ...rangeQueryParams(window),
    lim: safeLimit,
    off: safeOffset,
  }

  const [countRes, rowsRes] = await Promise.all([
    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT count() AS c
        FROM (
          SELECT session_id
          FROM events_raw
          WHERE ${where}
          GROUP BY session_id
        )
      `,
    }),
    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT
          l.session_id AS session_id,
          l.last_at AS last_at,
          l.props AS props,
          z.zip_val AS zip_val
        FROM (
          SELECT
            session_id,
            max(created_at) AS last_at,
            argMax(properties, (length(properties), created_at)) AS props
          FROM events_raw
          WHERE ${where}
          GROUP BY session_id
        ) AS l
        LEFT JOIN (
          SELECT
            session_id,
            max(nullIf(zipcode, '')) AS zip_val
          FROM events_raw
          WHERE ${rangeFilter()}
            AND zipcode != ''
          GROUP BY session_id
        ) AS z ON z.session_id = l.session_id
        ORDER BY last_at DESC
        LIMIT {lim:UInt32} OFFSET {off:UInt32}
      `,
    }),
  ])

  const total = Number(
    ((await countRes.json()) as CHJson<{ c: string | number }>).data?.[0]?.c ??
      0,
  )
  const rows =
    (
      (await rowsRes.json()) as CHJson<{
        session_id: string
        last_at: string
        props: string
        zip_val: string
      }>
    ).data ?? []

  const leads: FunnelLeadRow[] = rows.map((row) => {
    const fields = parseFields(row.props || '{}')
    const email = pickLeadEmail(fields)
    const zip = row.zip_val || pickLeadZip(fields) || ''
    return {
      sessionId: row.session_id,
      createdAt: row.last_at,
      zip,
      email,
      fields: fieldsWithoutReserved(fields),
    }
  })

  return {
    rangeId: window.rangeId,
    leads,
    total,
    limit: safeLimit,
    offset: safeOffset,
    hasMore: safeOffset + leads.length < total,
  }
}

export function emptyFunnelLeads(
  rangeId: AnalyticsRangeId,
  limit = 15,
  offset = 0,
): FunnelLeadsResponse {
  return {
    rangeId,
    leads: [],
    total: 0,
    limit,
    offset,
    hasMore: false,
  }
}
