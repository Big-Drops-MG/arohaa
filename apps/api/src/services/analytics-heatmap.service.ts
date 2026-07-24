import { getClickHouseClient } from './clickhouse.service.js'
import {
  rangeQueryParams,
  resolveAnalyticsWindow,
  type AnalyticsCustomRange,
  type AnalyticsRangeId,
} from '../lib/analytics-range.js'
import { chToDate } from '../lib/analytics-timezone.js'
import type {
  AnalyticsHeatmapResponse,
  HeatmapCell,
  HeatmapDevice,
  HeatmapMode,
  HeatmapPoint,
  HeatmapScrollBucket,
  HeatmapSection,
} from '../types/analytics-heatmap.js'

type CHJson<T> = { data: T[] }

const n = (v: string | number | null | undefined): number =>
  typeof v === 'number' ? v : Number(v ?? 0) || 0

const DAY_FILTER = `
  workspace_id = {wid:UUID}
  AND day >= ${chToDate("toDateTime64({range_from:String}, 3, 'UTC')")}
  AND day <= ${chToDate("toDateTime64({range_to:String}, 3, 'UTC') - INTERVAL 1 MILLISECOND")}
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
    maxValue: 0,
    totalEvents: 0,
  }
}

const RAW_TIME_FILTER = `
  workspace_id = {wid:UUID}
  AND timestamp >= toDateTime64({range_from:String}, 3, 'UTC')
  AND timestamp <= toDateTime64({range_to:String}, 3, 'UTC') - INTERVAL 1 MILLISECOND
`

function deviceSql(device: HeatmapDevice): string {
  if (device === 'all') return ''
  return ' AND device = {device:String}'
}

function pageUrlSql(pageUrl: string | null): string {
  if (!pageUrl) return ''
  return ' AND page_url = {page_url:String}'
}

async function listPageUrls(
  workspaceId: string,
  rangeParams: { range_from: string; range_to: string },
): Promise<string[]> {
  const ch = getClickHouseClient()
  const res = await ch.query({
    format: 'JSON',
    query_params: { wid: workspaceId, ...rangeParams },
    query: `
      SELECT DISTINCT page_url
      FROM (
        SELECT page_url FROM heatmap_clicks_rollup WHERE ${DAY_FILTER}
        UNION ALL
        SELECT page_url FROM heatmap_mousemove_rollup WHERE ${DAY_FILTER}
        UNION ALL
        SELECT page_url FROM heatmap_scroll_rollup WHERE ${DAY_FILTER}
        UNION ALL
        SELECT page_url FROM heatmap_section_rollup WHERE ${DAY_FILTER}
      )
      WHERE page_url != ''
      ORDER BY page_url
      LIMIT 200
    `,
  })
  const json = (await res.json()) as CHJson<{ page_url: string }>
  return json.data.map((row) => row.page_url)
}

async function queryClickCells(
  workspaceId: string,
  pageUrl: string,
  device: HeatmapDevice,
  rangeParams: { range_from: string; range_to: string },
): Promise<HeatmapCell[]> {
  const ch = getClickHouseClient()
  const res = await ch.query({
    format: 'JSON',
    query_params: {
      wid: workspaceId,
      page_url: pageUrl,
      device,
      ...rangeParams,
    },
    query: `
      SELECT
        grid_x AS gridX,
        grid_y AS gridY,
        countMerge(clicks) AS value
      FROM heatmap_clicks_rollup
      WHERE ${DAY_FILTER}${pageUrlSql(pageUrl)}${deviceSql(device)}
      GROUP BY grid_x, grid_y
      HAVING value > 0
      ORDER BY value DESC
    `,
  })
  const json = (await res.json()) as CHJson<{
    gridX: string | number
    gridY: string | number
    value: string | number
  }>
  return json.data.map((row) => ({
    gridX: n(row.gridX),
    gridY: n(row.gridY),
    value: n(row.value),
  }))
}

async function queryMoveCells(
  workspaceId: string,
  pageUrl: string,
  device: HeatmapDevice,
  rangeParams: { range_from: string; range_to: string },
): Promise<HeatmapCell[]> {
  const ch = getClickHouseClient()
  const res = await ch.query({
    format: 'JSON',
    query_params: {
      wid: workspaceId,
      page_url: pageUrl,
      device,
      ...rangeParams,
    },
    query: `
      SELECT
        grid_x AS gridX,
        grid_y AS gridY,
        countMerge(moves) AS value
      FROM heatmap_mousemove_rollup
      WHERE ${DAY_FILTER}${pageUrlSql(pageUrl)}${deviceSql(device)}
      GROUP BY grid_x, grid_y
      HAVING value > 0
      ORDER BY value DESC
    `,
  })
  const json = (await res.json()) as CHJson<{
    gridX: string | number
    gridY: string | number
    value: string | number
  }>
  return json.data.map((row) => ({
    gridX: n(row.gridX),
    gridY: n(row.gridY),
    value: n(row.value),
  }))
}

async function queryScrollBuckets(
  workspaceId: string,
  pageUrl: string,
  device: HeatmapDevice,
  rangeParams: { range_from: string; range_to: string },
): Promise<HeatmapScrollBucket[]> {
  const ch = getClickHouseClient()
  const res = await ch.query({
    format: 'JSON',
    query_params: {
      wid: workspaceId,
      page_url: pageUrl,
      device,
      ...rangeParams,
    },
    query: `
      SELECT
        scroll_depth_bucket AS bucket,
        countMerge(events) AS value
      FROM heatmap_scroll_rollup
      WHERE ${DAY_FILTER}${pageUrlSql(pageUrl)}${deviceSql(device)}
      GROUP BY scroll_depth_bucket
      HAVING value > 0
      ORDER BY bucket ASC
    `,
  })
  const json = (await res.json()) as CHJson<{
    bucket: string | number
    value: string | number
  }>
  return json.data.map((row) => ({
    bucket: n(row.bucket),
    value: n(row.value),
  }))
}

async function querySections(
  workspaceId: string,
  pageUrl: string,
  device: HeatmapDevice,
  rangeParams: { range_from: string; range_to: string },
): Promise<HeatmapSection[]> {
  const ch = getClickHouseClient()
  const res = await ch.query({
    format: 'JSON',
    query_params: {
      wid: workspaceId,
      page_url: pageUrl,
      device,
      ...rangeParams,
    },
    query: `
      SELECT
        element_selector AS selector,
        sumMerge(dwell_ms) AS dwellMs,
        countMerge(views) AS views
      FROM heatmap_section_rollup
      WHERE ${DAY_FILTER}${pageUrlSql(pageUrl)}${deviceSql(device)}
        AND element_selector != ''
      GROUP BY element_selector
      HAVING views > 0
      ORDER BY dwellMs DESC
      LIMIT 50
    `,
  })
  const json = (await res.json()) as CHJson<{
    selector: string
    dwellMs: string | number
    views: string | number
  }>
  return json.data.map((row) => ({
    selector: row.selector,
    dwellMs: n(row.dwellMs),
    views: n(row.views),
  }))
}

async function queryPoints(
  workspaceId: string,
  pageUrl: string,
  device: HeatmapDevice,
  eventType: 'click' | 'mousemove',
  rangeParams: { range_from: string; range_to: string },
): Promise<HeatmapPoint[]> {
  const ch = getClickHouseClient()
  const res = await ch.query({
    format: 'JSON',
    query_params: {
      wid: workspaceId,
      page_url: pageUrl,
      device,
      etype: eventType,
      ...rangeParams,
    },
    query: `
      SELECT
        round(x, 4) AS x,
        round(y, 4) AS y,
        count() AS value
      FROM heatmap_events
      WHERE ${RAW_TIME_FILTER}
        AND event_type = {etype:String}${pageUrlSql(pageUrl)}${deviceSql(device)}
      GROUP BY x, y
      ORDER BY value DESC
      LIMIT 8000
    `,
  })
  const json = (await res.json()) as CHJson<{
    x: string | number
    y: string | number
    value: string | number
  }>
  return json.data.map((row) => ({
    x: n(row.x),
    y: n(row.y),
    value: n(row.value),
  }))
}

export async function getAnalyticsHeatmap({
  workspaceId,
  mode,
  device,
  pageUrl: pageUrlInput,
  rangeId,
  custom,
}: {
  workspaceId: string
  mode: HeatmapMode
  device: HeatmapDevice
  pageUrl?: string | null
  rangeId: AnalyticsRangeId
  custom?: AnalyticsCustomRange
}): Promise<AnalyticsHeatmapResponse> {
  const window = resolveAnalyticsWindow(rangeId, new Date(), custom)
  const rangeParams = rangeQueryParams(window)
  const pageUrls = await listPageUrls(workspaceId, rangeParams)

  const requested = pageUrlInput?.trim() || null
  const pageUrl = requested || pageUrls[0] || null
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

  if (mode === 'click') {
    cells = await queryClickCells(workspaceId, pageUrl, device, rangeParams)
    points = await queryPoints(
      workspaceId,
      pageUrl,
      device,
      'click',
      rangeParams,
    )
  } else if (mode === 'scroll') {
    scrollBuckets = await queryScrollBuckets(
      workspaceId,
      pageUrl,
      device,
      rangeParams,
    )
  } else {
    cells = await queryMoveCells(workspaceId, pageUrl, device, rangeParams)
    points = await queryPoints(
      workspaceId,
      pageUrl,
      device,
      'mousemove',
      rangeParams,
    )
    sections = await querySections(workspaceId, pageUrl, device, rangeParams)
  }

  const values =
    mode === 'scroll'
      ? scrollBuckets.map((b) => b.value)
      : points.length > 0
        ? points.map((p) => p.value)
        : cells.map((c) => c.value)
  const maxValue = values.reduce((m, v) => (v > m ? v : m), 0)
  const totalEvents = values.reduce((s, v) => s + v, 0)

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
    maxValue,
    totalEvents,
  }
}
