import type { DashboardCustomRange } from "../../features/traffic/model/traffic-range.js"
import {
  MAX_DASHBOARD_CUSTOM_SPAN_DAYS,
  parseDashboardCustomRange,
} from "../../features/traffic/model/traffic-range.js"

export { MAX_DASHBOARD_CUSTOM_SPAN_DAYS }

export const DEFAULT_ROUTE_MAX_OFFSET = 10_000

export function customRangeSpanDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`)
  const end = Date.parse(`${to}T00:00:00.000Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1
}

export function parseRouteCustomRange(
  from: string | null | undefined,
  to: string | null | undefined,
  maxDays = MAX_DASHBOARD_CUSTOM_SPAN_DAYS
): DashboardCustomRange | undefined {
  const range = parseDashboardCustomRange(from, to)
  if (!range) return undefined
  if (customRangeSpanDays(range.from, range.to) > maxDays) return undefined
  return range
}

export function parseRouteOffset(
  raw: string | null | undefined,
  maxOffset = DEFAULT_ROUTE_MAX_OFFSET
): number {
  const value = Math.max(0, Number(raw ?? 0) || 0)
  return Math.min(value, maxOffset)
}

export function sanitizeHeatmapPageUrl(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > 2048) return null
  if (/[\x00-\x1f\x7f]/.test(trimmed)) return null

  try {
    const u = new URL(trimmed)
    if (u.protocol !== "http:" && u.protocol !== "https:") return null
    const hash = u.hash || ""
    u.search = ""
    u.hash = ""
    const base = u.toString().replace(/\?$/, "")
    return `${base}${hash}`
  } catch {
    if (!trimmed.startsWith("/")) return null
    return trimmed.replace(/\?[^#]*/, "")
  }
}
