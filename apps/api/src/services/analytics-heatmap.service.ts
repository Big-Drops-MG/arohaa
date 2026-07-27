import { getClickHouseClient } from './clickhouse.service.js'
import {
  rangeQueryParams,
  resolveAnalyticsWindow,
  type AnalyticsCustomRange,
  type AnalyticsRangeId,
} from '../lib/analytics-range.js'
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

/** Cap painted clusters — enough for dense heat, small enough for postMessage + canvas. */
const POINTS_LIMIT = 2500
const MOVE_POINTS_LIMIT = 1800

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

/**
 * Inclusive start / exclusive end on raw timestamps — matches every preset and
 * custom ET window from resolveAnalyticsWindow (today, 7d, custom, …).
 */
const RAW_TIME_FILTER = `
  workspace_id = {wid:UUID}
  AND timestamp >= toDateTime64({range_from:String}, 3, 'UTC')
  AND timestamp < toDateTime64({range_to:String}, 3, 'UTC')
`

/**
 * Include every event that belongs on this device preview.
 * Match by stored device label OR capture viewport width so legacy rows still appear.
 */
function deviceMatchSql(device: HeatmapDevice): string {
  if (device === 'all') return ''
  if (device === 'mobile') {
    return ` AND (
      device = {device:String}
      OR (viewport_width > 0 AND viewport_width < 768)
    )`
  }
  if (device === 'tablet') {
    return ` AND (
      device = {device:String}
      OR (viewport_width >= 768 AND viewport_width < 1024)
    )`
  }
  if (device === 'desktop') {
    return ` AND (
      device = {device:String}
      OR viewport_width >= 1024
    )`
  }
  return ''
}

function pageUrlSql(pageUrl: string | null): string {
  if (!pageUrl) return ''
  return ' AND page_url = {page_url:String}'
}

/** Discover pages from raw events so every time range sees real traffic. */
async function listPageUrls(
  workspaceId: string,
  rangeParams: { range_from: string; range_to: string },
): Promise<string[]> {
  const ch = getClickHouseClient()
  const res = await ch.query({
    format: 'JSON',
    query_params: { wid: workspaceId, ...rangeParams },
    query: `
      SELECT page_url, count() AS c
      FROM heatmap_events
      WHERE ${RAW_TIME_FILTER}
        AND page_url != ''
      GROUP BY page_url
      ORDER BY c DESC
      LIMIT 100
    `,
  })
  const json = (await res.json()) as CHJson<{ page_url: string }>
  return json.data.map((row) => row.page_url)
}

async function queryEventCount(
  workspaceId: string,
  pageUrl: string,
  device: HeatmapDevice,
  eventType: string,
  rangeParams: { range_from: string; range_to: string },
): Promise<number> {
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
      SELECT count() AS value
      FROM heatmap_events
      WHERE ${RAW_TIME_FILTER}
        AND event_type = {etype:String}${pageUrlSql(pageUrl)}${deviceMatchSql(device)}
    `,
  })
  const json = (await res.json()) as CHJson<{ value: string | number }>
  return n(json.data[0]?.value)
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

async function queryClickPoints(
  workspaceId: string,
  pageUrl: string,
  device: HeatmapDevice,
  rangeParams: { range_from: string; range_to: string },
): Promise<HeatmapPoint[]> {
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
        round(x, 3) AS px,
        round(y, 3) AS py,
        element_selector AS selector,
        round(JSONExtractFloat(properties, 'x'), 2) AS ex,
        round(JSONExtractFloat(properties, 'y'), 2) AS ey,
        count() AS value
      FROM heatmap_events
      WHERE ${RAW_TIME_FILTER}
        AND event_type = 'click'${pageUrlSql(pageUrl)}${deviceMatchSql(device)}
      GROUP BY px, py, selector, ex, ey
      ORDER BY value DESC
      LIMIT ${POINTS_LIMIT}
    `,
  })
  const json = (await res.json()) as CHJson<{
    px: string | number
    py: string | number
    selector: string
    ex: string | number
    ey: string | number
    value: string | number
  }>
  return json.data.map((row) => ({
    x: n(row.px),
    y: n(row.py),
    value: n(row.value),
    selector: row.selector || null,
    ex: n(row.ex),
    ey: n(row.ey),
  }))
}

async function queryMovePoints(
  workspaceId: string,
  pageUrl: string,
  device: HeatmapDevice,
  rangeParams: { range_from: string; range_to: string },
): Promise<HeatmapPoint[]> {
  const ch = getClickHouseClient()
  // Attention heat is page-relative only — skip JSON extracts for speed.
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
        round(x, 3) AS px,
        round(y, 3) AS py,
        count() AS value
      FROM heatmap_events
      WHERE ${RAW_TIME_FILTER}
        AND event_type = 'mousemove'${pageUrlSql(pageUrl)}${deviceMatchSql(device)}
      GROUP BY px, py
      ORDER BY value DESC
      LIMIT ${MOVE_POINTS_LIMIT}
    `,
  })
  const json = (await res.json()) as CHJson<{
    px: string | number
    py: string | number
    value: string | number
  }>
  return json.data.map((row) => ({
    x: n(row.px),
    y: n(row.py),
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
        toInt32(floor(least(greatest(y, 0.), 0.9999) * 10.) * 10) AS bucket,
        count() AS value
      FROM heatmap_events
      WHERE ${RAW_TIME_FILTER}
        AND event_type = 'scroll'${pageUrlSql(pageUrl)}${deviceMatchSql(device)}
      GROUP BY bucket
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
        sum(JSONExtractFloat(properties, 'dwell_ms')) AS dwellMs,
        count() AS views
      FROM heatmap_events
      WHERE ${RAW_TIME_FILTER}
        AND event_type = 'section'
        AND element_selector != ''${pageUrlSql(pageUrl)}${deviceMatchSql(device)}
      GROUP BY element_selector
      HAVING views > 0
      ORDER BY dwellMs DESC
      LIMIT 40
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
  let totalEvents = 0

  if (mode === 'click') {
    const [clickPoints, count] = await Promise.all([
      queryClickPoints(workspaceId, pageUrl, device, rangeParams),
      queryEventCount(workspaceId, pageUrl, device, 'click', rangeParams),
    ])
    points = clickPoints
    cells = cellsFromPoints(clickPoints)
    totalEvents = count
  } else if (mode === 'scroll') {
    scrollBuckets = await queryScrollBuckets(
      workspaceId,
      pageUrl,
      device,
      rangeParams,
    )
    totalEvents = scrollBuckets.reduce((s, b) => s + b.value, 0)
  } else {
    const [movePoints, count, sectionRows] = await Promise.all([
      queryMovePoints(workspaceId, pageUrl, device, rangeParams),
      queryEventCount(workspaceId, pageUrl, device, 'mousemove', rangeParams),
      querySections(workspaceId, pageUrl, device, rangeParams),
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
    maxValue,
    totalEvents,
  }
}
