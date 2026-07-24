import type { EventRow } from '../types/event.js'

export type HeatmapEventType = 'click' | 'mousemove' | 'scroll' | 'section'

export type HeatmapRow = {
  workspace_id: string
  page_url: string
  event_type: HeatmapEventType
  timestamp: string
  x: number
  y: number
  viewport_width: number
  viewport_height: number
  device: string
  element_selector: string
  properties: string
}

const HEATMAP_SDK_EVENTS = new Set([
  'heatmap_click',
  'heatmap_move',
  'heatmap_section',
])

const CH_TS_RE =
  /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:?\d{2})?$/

function parseProps(raw: string): Record<string, unknown> {
  if (!raw || raw === '{}') return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // ignore
  }
  return {}
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0')
}

export function toHeatmapTimestamp(value: unknown): string | null {
  let date: Date | null = null

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (CH_TS_RE.test(trimmed)) {
      return trimmed.includes('T')
        ? trimmed.replace('T', ' ').replace(/Z$/, '')
        : trimmed
    }
    const parsed = Date.parse(
      trimmed.includes(' ') ? trimmed.replace(' ', 'T') : trimmed,
    )
    if (Number.isNaN(parsed)) return null
    date = new Date(parsed)
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    date = new Date(value < 1e12 ? value * 1000 : value)
  } else if (value instanceof Date && !Number.isNaN(value.getTime())) {
    date = value
  }

  if (!date) return null

  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`
}

function resolveDevice(row: EventRow, props: Record<string, unknown>): string {
  const fromProps = str(props.device)
  if (
    fromProps === 'mobile' ||
    fromProps === 'tablet' ||
    fromProps === 'desktop'
  ) {
    return fromProps
  }
  const fromRow = row.device?.trim()
  if (fromRow) return fromRow
  const vw = num(props.vw)
  if (vw > 0) {
    if (vw < 768) return 'mobile'
    if (vw < 1024) return 'tablet'
    return 'desktop'
  }
  return 'desktop'
}

export function shouldRouteToHeatmapQueue(row: EventRow): boolean {
  return (
    HEATMAP_SDK_EVENTS.has(row.event_name) || row.event_name === 'scroll_depth'
  )
}

export function eventRowToHeatmapRow(row: EventRow): HeatmapRow | null {
  const workspaceId = row.workspace_id?.trim()
  if (!workspaceId) return null

  const pageUrl = (row.url || '').trim()
  if (!pageUrl) return null

  const timestamp = toHeatmapTimestamp(row.created_at)
  if (!timestamp) return null

  const props = parseProps(row.properties)
  const device = resolveDevice(row, props)

  if (row.event_name === 'heatmap_click') {
    return {
      workspace_id: workspaceId,
      page_url: pageUrl,
      event_type: 'click',
      timestamp,
      x: clamp01(num(props.px, num(props.vx, num(props.x)))),
      y: clamp01(num(props.py, num(props.vy, num(props.y)))),
      viewport_width: Math.round(num(props.vw)),
      viewport_height: Math.round(num(props.vh)),
      device,
      element_selector: str(props.selector).slice(0, 500),
      properties: row.properties || '{}',
    }
  }

  if (row.event_name === 'heatmap_move') {
    return {
      workspace_id: workspaceId,
      page_url: pageUrl,
      event_type: 'mousemove',
      timestamp,
      x: clamp01(num(props.px, num(props.vx))),
      y: clamp01(num(props.py, num(props.vy))),
      viewport_width: Math.round(num(props.vw)),
      viewport_height: Math.round(num(props.vh)),
      device,
      element_selector: '',
      properties: row.properties || '{}',
    }
  }

  if (row.event_name === 'heatmap_section') {
    return {
      workspace_id: workspaceId,
      page_url: pageUrl,
      event_type: 'section',
      timestamp,
      x: 0,
      y: 0,
      viewport_width: 0,
      viewport_height: 0,
      device,
      element_selector: str(props.selector).slice(0, 500),
      properties: row.properties || '{}',
    }
  }

  if (row.event_name === 'scroll_depth') {
    const percent =
      typeof row.metric_value === 'number' && Number.isFinite(row.metric_value)
        ? row.metric_value
        : num(props.max_percent)
    return {
      workspace_id: workspaceId,
      page_url: pageUrl,
      event_type: 'scroll',
      timestamp,
      x: 0,
      y: clamp01(percent / 100),
      viewport_width: 0,
      viewport_height: 0,
      device,
      element_selector: '',
      properties: row.properties || '{}',
    }
  }

  return null
}

export function isHeatmapOnlyEvent(row: EventRow): boolean {
  return HEATMAP_SDK_EVENTS.has(row.event_name)
}
