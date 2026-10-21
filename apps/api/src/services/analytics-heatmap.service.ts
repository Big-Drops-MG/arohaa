import {
  HEATMAP_POINT_ROLLUP_TABLE,
  getAnalyticsClickHouseClient,
} from './clickhouse.service.js'
import {
  rangeQueryParams,
  resolveAnalyticsWindowForLanding,
  type AnalyticsCustomRange,
  type AnalyticsRangeId,
} from '../lib/analytics-range.js'
import {
  normalizeAnalyticsUtmFilter,
  utmFilterParams,
  utmFilterSql,
  type AnalyticsUtmFilter,
} from '../lib/analytics-utm-filter.js'
import { dailyMetricsRangeFilter } from '../lib/session-rollup-sql.js'
import { canonicalizeHeatmapPageUrl } from './heatmap-route.js'
import type {
  AnalyticsHeatmapResponse,
  HeatmapCell,
  HeatmapDevice,
  HeatmapField,
  HeatmapMode,
  HeatmapPoint,
  HeatmapScrollBucket,
  HeatmapSection,
} from '../types/analytics-heatmap.js'

type CHJson<T> = { data: T[] }
type RangeParams = { range_from: string; range_to: string }

const n = (v: string | number | null | undefined): number =>
  typeof v === 'number' ? v : Number(v ?? 0) || 0

const POINTS_LIMIT = 5000
const MOVE_POINTS_LIMIT = 4000

const RESOLVED_DEVICE_SQL = `
  multiIf(
    device IN ('mobile', 'tablet', 'desktop'), device,
    viewport_width > 0 AND viewport_width < 768, 'mobile',
    viewport_width >= 768 AND viewport_width < 1024, 'tablet',
    'desktop'
  )
`

export function emptyAnalyticsHeatmap(
  rangeId: AnalyticsRangeId,
  mode: HeatmapMode = 'click',
  device: HeatmapDevice = 'all',
): AnalyticsHeatmapResponse {
  return {
    rangeId,
    mode,
    device,
    pageUrl: null,
    pageUrls: [],
    cells: [],
    points: [],
    scrollBuckets: [],
    sections: [],
    fields: [],
    maxValue: 0,
    totalEvents: 0,
  }
}

const RAW_TIME_FILTER = `
  workspace_id = {wid:UUID}
  AND timestamp >= toDateTime64({range_from:String}, 3, 'UTC')
  AND timestamp < toDateTime64({range_to:String}, 3, 'UTC')
`

const PAGE_KEY_SQL = `replaceRegexpOne(page_url, '\\\\?[^#]*', '')`
const FIELD_NAME_EXPR = `nullIf(JSONExtractString(properties, 'fieldName'), '')`


function useRollup(utmFilter?: AnalyticsUtmFilter): boolean {
  return !normalizeAnalyticsUtmFilter(utmFilter)?.segmentSql
}

function rollupUtmSql(utmFilter?: AnalyticsUtmFilter): string {
  const normalized = normalizeAnalyticsUtmFilter(utmFilter)
  if (!normalized) return ''
  const parts: string[] = []
  if (normalized.utm_source?.length) parts.push('utm_source IN {utm_sources:Array(String)}')
  if (normalized.utm_s1?.length) parts.push('utm_s1 IN {utm_s1s:Array(String)}')
  return parts.length ? ` AND ${parts.join(' AND ')}` : ''
}

function rollupFilter(
  pageUrl: string | null,
  device: HeatmapDevice,
  utmFilter?: AnalyticsUtmFilter,
): string {
  return (
    dailyMetricsRangeFilter() +
    rollupUtmSql(utmFilter) +
    (pageUrl ? ' AND page_key = {page_url:String}' : '') +
    (device === 'all' ? '' : ' AND device = {device:String}')
  )
}

function rawFilter(
  pageUrl: string | null,
  device: HeatmapDevice,
  utmFilter?: AnalyticsUtmFilter,
): string {
  return (
    RAW_TIME_FILTER +
    utmFilterSql(utmFilter) +
    (pageUrl ? ` AND ${PAGE_KEY_SQL} = {page_url:String}` : '') +
    (device === 'all' ? '' : ` AND (${RESOLVED_DEVICE_SQL}) = {device:String}`)
  )
}

function queryParams(
  workspaceId: string,
  rangeParams: RangeParams,
  utmFilter?: AnalyticsUtmFilter,
  extra: Record<string, string> = {},
): Record<string, unknown> {
  return {
    wid: workspaceId,
    ...rangeParams,
    ...utmFilterParams(utmFilter),
    ...extra,
  }
}

async function runJson<T>(query: string, params: Record<string, unknown>): Promise<T[]> {
  const ch = getAnalyticsClickHouseClient()
  const res = await ch.query({ format: 'JSON', query_params: params, query })
  return ((await res.json()) as CHJson<T>).data
}

async function listPageUrls(
  workspaceId: string,
  rangeParams: RangeParams,
  utmFilter?: AnalyticsUtmFilter,
): Promise<string[]> {
  const params = queryParams(workspaceId, rangeParams, utmFilter)
  const rows = useRollup(utmFilter)
    ? await runJson<{ page_key: string }>(
        `
        SELECT page_key, sum(value) AS c, min(first_at) AS first_at
        FROM ${HEATMAP_POINT_ROLLUP_TABLE}
        WHERE ${rollupFilter(null, 'all', utmFilter)}
          AND page_key != ''
        GROUP BY page_key
        ORDER BY first_at ASC, c DESC
        LIMIT 200
        `,
        params,
      )
    : await runJson<{ page_key: string }>(
        `
        SELECT ${PAGE_KEY_SQL} AS page_key, count() AS c, min(timestamp) AS first_at
        FROM heatmap_events
        WHERE ${rawFilter(null, 'all', utmFilter)}
          AND page_url != ''
        GROUP BY page_key
        HAVING page_key != ''
        ORDER BY first_at ASC, c DESC
        LIMIT 200
        `,
        params,
      )
  return rows.map((row) => row.page_key)
}

async function queryEventCount(
  workspaceId: string,
  pageUrl: string,
  device: HeatmapDevice,
  eventType: string,
  rangeParams: RangeParams,
  utmFilter?: AnalyticsUtmFilter,
): Promise<number> {
  const params = queryParams(workspaceId, rangeParams, utmFilter, {
    page_url: pageUrl,
    device,
    etype: eventType,
  })
  const rows = useRollup(utmFilter)
    ? await runJson<{ cnt: string | number }>(
        `
        SELECT sum(value) AS cnt
        FROM ${HEATMAP_POINT_ROLLUP_TABLE}
        WHERE ${rollupFilter(pageUrl, device, utmFilter)}
          AND event_type = {etype:String}
        `,
        params,
      )
    : await runJson<{ cnt: string | number }>(
        `
        SELECT count() AS cnt
        FROM heatmap_events
        WHERE ${rawFilter(pageUrl, device, utmFilter)}
          AND event_type = {etype:String}
        `,
        params,
      )
  return n(rows[0]?.cnt)
}

function cellsFromPoints(points: HeatmapPoint[]): HeatmapCell[] {
  const map = new Map<string, HeatmapCell>()
  for (const p of points) {
    const gridX = Math.floor(Math.min(0.9999, Math.max(0, p.x)) * 10) * 10
    const gridY = Math.floor(Math.min(0.9999, Math.max(0, p.y)) * 10) * 10
    const key = `${gridX}:${gridY}`
    const existing = map.get(key)
    if (existing) {
      existing.value += p.value
    } else {
      map.set(key, { gridX, gridY, value: p.value })
    }
  }
  return Array.from(map.values())
}

type SelectorPointRow = {
  selector: string
  px: string | number
  py: string | number
  ex: string | number
  ey: string | number
  cnt: string | number
}

function mapSelectorPoints(rows: SelectorPointRow[]): HeatmapPoint[] {
  return rows.map((row) => ({
    x: n(row.px),
    y: n(row.py),
    value: n(row.cnt),
    selector: row.selector || null,
    ex: row.selector ? n(row.ex) : null,
    ey: row.selector ? n(row.ey) : null,
  }))
}

async function querySelectorPoints(
  workspaceId: string,
  pageUrl: string,
  device: HeatmapDevice,
  rangeParams: RangeParams,
  utmFilter: AnalyticsUtmFilter | undefined,
  eventTypesSql: string,
  requireFieldName: boolean,
): Promise<HeatmapPoint[]> {
  const params = queryParams(workspaceId, rangeParams, utmFilter, {
    page_url: pageUrl,
    device,
  })
  if (useRollup(utmFilter)) {
    const rows = await runJson<SelectorPointRow>(
      `
      SELECT
        selector,
        sum(sum_x) / sum(value) AS px,
        sum(sum_y) / sum(value) AS py,
        sum(sum_ex) / sum(value) AS ex,
        sum(sum_ey) / sum(value) AS ey,
        sum(value) AS cnt
      FROM ${HEATMAP_POINT_ROLLUP_TABLE}
      WHERE ${rollupFilter(pageUrl, device, utmFilter)}
        AND event_type IN (${eventTypesSql})${requireFieldName ? " AND field_name != ''" : ''}
      GROUP BY selector, gx, gy
      ORDER BY cnt DESC
      LIMIT ${POINTS_LIMIT}
      `,
      params,
    )
    return mapSelectorPoints(rows)
  }
  const rows = await runJson<SelectorPointRow>(
    `
    WITH
      if(JSONHas(properties, 'x'), JSONExtractFloat(properties, 'x'), x) AS exv,
      if(JSONHas(properties, 'y'), JSONExtractFloat(properties, 'y'), y) AS eyv
    SELECT
      element_selector AS selector,
      if(element_selector = '', round(x, 2), round(exv, 1)) AS gx,
      if(element_selector = '', round(y, 2), round(eyv, 1)) AS gy,
      avg(x) AS px,
      avg(y) AS py,
      avg(exv) AS ex,
      avg(eyv) AS ey,
      count() AS cnt
    FROM heatmap_events
    WHERE ${rawFilter(pageUrl, device, utmFilter)}
      AND event_type IN (${eventTypesSql})${requireFieldName ? ` AND ${FIELD_NAME_EXPR} != ''` : ''}
    GROUP BY selector, gx, gy
    ORDER BY cnt DESC
    LIMIT ${POINTS_LIMIT}
    `,
    params,
  )
  return mapSelectorPoints(rows)
}

async function queryMovePoints(
  workspaceId: string,
  pageUrl: string,
  device: HeatmapDevice,
  rangeParams: RangeParams,
  utmFilter?: AnalyticsUtmFilter,
): Promise<HeatmapPoint[]> {
  const params = queryParams(workspaceId, rangeParams, utmFilter, {
    page_url: pageUrl,
    device,
  })
  type Row = { px: string | number; py: string | number; cnt: string | number }
  const rows = useRollup(utmFilter)
    ? await runJson<Row>(
        `
        SELECT gx AS px, gy AS py, sum(value) AS cnt
        FROM ${HEATMAP_POINT_ROLLUP_TABLE}
        WHERE ${rollupFilter(pageUrl, device, utmFilter)}
          AND event_type = 'mousemove'
        GROUP BY px, py
        ORDER BY cnt DESC
        LIMIT ${MOVE_POINTS_LIMIT}
        `,
        params,
      )
    : await runJson<Row>(
        `
        SELECT round(x, 2) AS px, round(y, 2) AS py, count() AS cnt
        FROM heatmap_events
        WHERE ${rawFilter(pageUrl, device, utmFilter)}
          AND event_type = 'mousemove'
        GROUP BY px, py
        ORDER BY cnt DESC
        LIMIT ${MOVE_POINTS_LIMIT}
        `,
        params,
      )
  return rows.map((row) => ({ x: n(row.px), y: n(row.py), value: n(row.cnt) }))
}

async function queryScrollBuckets(
  workspaceId: string,
  pageUrl: string,
  device: HeatmapDevice,
  rangeParams: RangeParams,
  utmFilter?: AnalyticsUtmFilter,
): Promise<HeatmapScrollBucket[]> {
  const params = queryParams(workspaceId, rangeParams, utmFilter, {
    page_url: pageUrl,
    device,
  })
  type Row = { bucket: string | number; cnt: string | number }
  const rows = useRollup(utmFilter)
    ? await runJson<Row>(
        `
        SELECT toInt32(gy) AS bucket, sum(value) AS cnt
        FROM ${HEATMAP_POINT_ROLLUP_TABLE}
        WHERE ${rollupFilter(pageUrl, device, utmFilter)}
          AND event_type = 'scroll'
        GROUP BY bucket
        HAVING cnt > 0
        ORDER BY bucket ASC
        `,
        params,
      )
    : await runJson<Row>(
        `
        SELECT
          toInt32(floor(least(greatest(y, 0.), 0.9999) * 10.) * 10) AS bucket,
          count() AS cnt
        FROM heatmap_events
        WHERE ${rawFilter(pageUrl, device, utmFilter)}
          AND event_type = 'scroll'
        GROUP BY bucket
        HAVING cnt > 0
        ORDER BY bucket ASC
        `,
        params,
      )
  return rows.map((row) => ({ bucket: n(row.bucket), value: n(row.cnt) }))
}

async function querySections(
  workspaceId: string,
  pageUrl: string,
  device: HeatmapDevice,
  rangeParams: RangeParams,
  utmFilter?: AnalyticsUtmFilter,
): Promise<HeatmapSection[]> {
  const params = queryParams(workspaceId, rangeParams, utmFilter, {
    page_url: pageUrl,
    device,
  })
  type Row = { selector: string; dwellMs: string | number; views: string | number }
  const rows = useRollup(utmFilter)
    ? await runJson<Row>(
        `
        SELECT selector, sum(dwell_ms) AS dwellMs, sum(value) AS views
        FROM ${HEATMAP_POINT_ROLLUP_TABLE}
        WHERE ${rollupFilter(pageUrl, device, utmFilter)}
          AND event_type = 'section'
          AND selector != ''
        GROUP BY selector
        HAVING views > 0
        ORDER BY dwellMs DESC
        LIMIT 40
        `,
        params,
      )
    : await runJson<Row>(
        `
        SELECT
          element_selector AS selector,
          sum(JSONExtractFloat(properties, 'dwell_ms')) AS dwellMs,
          count() AS views
        FROM heatmap_events
        WHERE ${rawFilter(pageUrl, device, utmFilter)}
          AND event_type = 'section'
          AND element_selector != ''
        GROUP BY element_selector
        HAVING views > 0
        ORDER BY dwellMs DESC
        LIMIT 40
        `,
        params,
      )
  return rows.map((row) => ({
    selector: row.selector,
    dwellMs: n(row.dwellMs),
    views: n(row.views),
  }))
}

async function queryFormFields(
  workspaceId: string,
  pageUrl: string,
  device: HeatmapDevice,
  rangeParams: RangeParams,
  utmFilter?: AnalyticsUtmFilter,
): Promise<HeatmapField[]> {
  const params = queryParams(workspaceId, rangeParams, utmFilter, {
    page_url: pageUrl,
    device,
  })
  type Row = { field_name: string; selector: string; cnt: string | number }
  const rows = useRollup(utmFilter)
    ? await runJson<Row>(
        `
        SELECT field_name, argMax(sel, v) AS selector, sum(v) AS cnt
        FROM (
          SELECT field_name, selector AS sel, sum(value) AS v
          FROM ${HEATMAP_POINT_ROLLUP_TABLE}
          WHERE ${rollupFilter(pageUrl, device, utmFilter)}
            AND event_type IN ('field_focus', 'click')
            AND field_name != ''
          GROUP BY field_name, sel
        )
        GROUP BY field_name
        HAVING cnt > 0
        ORDER BY cnt DESC
        LIMIT 40
        `,
        params,
      )
    : await runJson<Row>(
        `
        SELECT
          ${FIELD_NAME_EXPR} AS field_name,
          anyHeavy(element_selector) AS selector,
          count() AS cnt
        FROM heatmap_events
        WHERE ${rawFilter(pageUrl, device, utmFilter)}
          AND event_type IN ('field_focus', 'click')
          AND ${FIELD_NAME_EXPR} != ''
        GROUP BY field_name
        HAVING cnt > 0
        ORDER BY cnt DESC
        LIMIT 40
        `,
        params,
      )
  return rows.map((row) => ({
    fieldName: row.field_name,
    count: n(row.cnt),
    selector: row.selector || '',
  }))
}

function heatmapPathKey(url: string): string {
  try {
    const u = new URL(canonicalizeHeatmapPageUrl(url))
    u.hash = ''
    let path = u.pathname
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
    u.pathname = path || '/'
    return `${u.origin}${u.pathname}`
  } catch {
    return canonicalizeHeatmapPageUrl(url).replace(/\/$/, '')
  }
}

function hasHash(url: string): boolean {
  try {
    return Boolean(new URL(url).hash)
  } catch {
    return url.includes('#')
  }
}

export function resolveAnalyticsHeatmapPageUrl(
  pageUrlInput: string | null | undefined,
  pageUrls: string[],
): string | null {
  const requested = canonicalizeHeatmapPageUrl(pageUrlInput ?? '') || null
  if (!requested) return pageUrls[0] || null
  if (pageUrls.includes(requested)) return requested

  const key = heatmapPathKey(requested)
  const samePath = pageUrls.filter((url) => heatmapPathKey(url) === key)
  if (samePath.length > 0) {
    return samePath.find((url) => !hasHash(url)) ?? samePath[0] ?? requested
  }

  return requested
}

export async function getAnalyticsHeatmap({
  workspaceId,
  mode,
  device,
  pageUrl: pageUrlInput,
  rangeId,
  custom,
  utmFilter,
}: {
  workspaceId: string
  mode: HeatmapMode
  device: HeatmapDevice
  pageUrl?: string | null
  rangeId: AnalyticsRangeId
  custom?: AnalyticsCustomRange
  utmFilter?: AnalyticsUtmFilter
}): Promise<AnalyticsHeatmapResponse> {
  const window = await resolveAnalyticsWindowForLanding(rangeId, workspaceId, new Date(), custom)
  const rangeParams = rangeQueryParams(window)
  const pageUrls = await listPageUrls(workspaceId, rangeParams, utmFilter)

  const pageUrl = resolveAnalyticsHeatmapPageUrl(pageUrlInput, pageUrls)
  const urls =
    pageUrl && !pageUrls.includes(pageUrl)
      ? [pageUrl, ...pageUrls]
      : pageUrls

  if (!pageUrl) {
    return emptyAnalyticsHeatmap(rangeId, mode, device)
  }

  let cells: HeatmapCell[] = []
  let points: HeatmapPoint[] = []
  let scrollBuckets: HeatmapScrollBucket[] = []
  let sections: HeatmapSection[] = []
  let fields: HeatmapField[] = []
  let totalEvents = 0

  if (mode === 'click') {
    const [clickPoints, count] = await Promise.all([
      querySelectorPoints(workspaceId, pageUrl, device, rangeParams, utmFilter, `'click'`, false),
      queryEventCount(workspaceId, pageUrl, device, 'click', rangeParams, utmFilter),
    ])
    points = clickPoints
    cells = cellsFromPoints(clickPoints)
    totalEvents = count
  } else if (mode === 'scroll') {
    scrollBuckets = await queryScrollBuckets(workspaceId, pageUrl, device, rangeParams, utmFilter)
    totalEvents = scrollBuckets.reduce((s, b) => s + b.value, 0)
  } else if (mode === 'form') {
    const [formPoints, formFields] = await Promise.all([
      querySelectorPoints(
        workspaceId,
        pageUrl,
        device,
        rangeParams,
        utmFilter,
        `'field_focus', 'click'`,
        true,
      ),
      queryFormFields(workspaceId, pageUrl, device, rangeParams, utmFilter),
    ])
    points = formPoints
    cells = cellsFromPoints(formPoints)
    fields = formFields
    totalEvents = formFields.reduce((s, f) => s + f.count, 0)
  } else {
    const [movePoints, count, sectionRows] = await Promise.all([
      queryMovePoints(workspaceId, pageUrl, device, rangeParams, utmFilter),
      queryEventCount(workspaceId, pageUrl, device, 'mousemove', rangeParams, utmFilter),
      querySections(workspaceId, pageUrl, device, rangeParams, utmFilter),
    ])
    points = movePoints
    cells = cellsFromPoints(movePoints)
    sections = sectionRows
    totalEvents = count
  }

  const values =
    mode === 'scroll'
      ? scrollBuckets.map((b) => b.value)
      : points.length > 0
        ? points.map((p) => p.value)
        : cells.map((c) => c.value)
  const maxValue = values.reduce((m, v) => (v > m ? v : m), 0)

  return {
    rangeId,
    mode,
    device,
    pageUrl,
    pageUrls: urls,
    cells,
    points,
    scrollBuckets,
    sections,
    fields,
    maxValue,
    totalEvents,
  }
}
