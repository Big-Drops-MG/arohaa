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

/**
 * Keep events whose capture viewport sits in the same device bucket the
 * preview renders at. Matching the SDK device breakpoints avoids mixing
 * mobile/tablet/desktop layouts into one overlay.
 */
function viewportWidthSql(device: HeatmapDevice): string {
  if (device === 'mobile') {
    return ' AND viewport_width > 0 AND viewport_width < 768'
  }
  if (device === 'tablet') {
    return ' AND viewport_width >= 768 AND viewport_width < 1024'
  }
  if (device === 'desktop') {
    return ' AND viewport_width >= 1024'
  }
  return ' AND viewport_width > 0'
}

/** Only keep rows that stored page-relative px/py (not legacy viewport vx/vy). */
const PAGE_COORD_SQL =
  " AND positionCaseInsensitive(properties, '\"px\"') > 0"

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

async function queryClickCellsFromEvents(
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
        toInt32(floor(least(greatest(x, 0.), 0.9999) * 10.) * 10) AS gridX,
        toInt32(floor(least(greatest(y, 0.), 0.9999) * 10.) * 10) AS gridY,
        count() AS value
      FROM heatmap_events
      WHERE ${RAW_TIME_FILTER}
        AND event_type = 'click'${pageUrlSql(pageUrl)}${deviceSql(device)}${viewportWidthSql(device)}${PAGE_COORD_SQL}
      GROUP BY gridX, gridY
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

async function queryMoveCellsFromEvents(
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
        toInt32(floor(least(greatest(x, 0.), 0.9999) * 10.) * 10) AS gridX,
        toInt32(floor(least(greatest(y, 0.), 0.9999) * 10.) * 10) AS gridY,
        count() AS value
      FROM heatmap_events
      WHERE ${RAW_TIME_FILTER}
        AND event_type = 'mousemove'${pageUrlSql(pageUrl)}${deviceSql(device)}${viewportWidthSql(device)}${PAGE_COORD_SQL}
      GROUP BY gridX, gridY
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
  // Group by page coords + element anchor so the live preview can re-attach
  // clicks to the same controls after responsive reflow (Crazy Egg style).
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
        round(x, 4) AS px,
        round(y, 4) AS py,
        element_selector AS selector,
        round(JSONExtractFloat(properties, 'x'), 3) AS ex,
        round(JSONExtractFloat(properties, 'y'), 3) AS ey,
        toInt32(round(avg(viewport_width))) AS vw,
        toInt32(round(avg(viewport_height))) AS vh,
        toInt32(round(avg(JSONExtractFloat(properties, 'dw')))) AS dw,
        toInt32(round(avg(JSONExtractFloat(properties, 'dh')))) AS dh,
        count() AS value
      FROM heatmap_events
      WHERE ${RAW_TIME_FILTER}
        AND event_type = {etype:String}${pageUrlSql(pageUrl)}${deviceSql(device)}${viewportWidthSql(device)}${PAGE_COORD_SQL}
      GROUP BY px, py, selector, ex, ey
      ORDER BY value DESC
      LIMIT 8000
    `,
  })
  const json = (await res.json()) as CHJson<{
    px: string | number
    py: string | number
    selector: string
    ex: string | number
    ey: string | number
    vw: string | number
    vh: string | number
    dw: string | number
    dh: string | number
    value: string | number
  }>
  const isClick = eventType === 'click'
  return json.data.map((row) => ({
    x: n(row.px),
    y: n(row.py),
    value: n(row.value),
    selector: isClick && row.selector ? row.selector : null,
    // Element offsets only exist on clicks; moves use page px/py only.
    ex: isClick ? n(row.ex) : null,
    ey: isClick ? n(row.ey) : null,
    viewportWidth: n(row.vw) || null,
    viewportHeight: n(row.vh) || null,
    documentWidth: n(row.dw) || null,
    documentHeight: n(row.dh) || null,
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
    points = await queryPoints(
      workspaceId,
      pageUrl,
      device,
      'click',
      rangeParams,
    )
    // Always build the grid from the same filtered raw events. Never fall back
    // to unfiltered rollups — those mix viewport widths and look like floating
    // blobs on the fixed preview frame.
    cells = await queryClickCellsFromEvents(
      workspaceId,
      pageUrl,
      device,
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
    points = await queryPoints(
      workspaceId,
      pageUrl,
      device,
      'mousemove',
      rangeParams,
    )
    cells = await queryMoveCellsFromEvents(
      workspaceId,
      pageUrl,
      device,
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
