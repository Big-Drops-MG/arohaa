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
    const out = `${base}${hash}`
    return out.length > 2048 ? null : out
  } catch {
    if (!trimmed.startsWith("/")) return null
    const hashIndex = trimmed.indexOf("#")
    const beforeHash = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed
    const hash = hashIndex >= 0 ? trimmed.slice(hashIndex) : ""
    const pathOnly = beforeHash.split("?", 1)[0] ?? ""
    if (!pathOnly.startsWith("/")) return null
    const out = `${pathOnly}${hash}`
    return out.length > 2048 ? null : out
  }
}

function joinLandingOrigin(
  pathOrUrl: string,
  landingPageUrl: string
): string | null {
  try {
    const absolute = new URL(pathOrUrl)
    if (absolute.protocol === "http:" || absolute.protocol === "https:") {
      return sanitizeHeatmapPageUrl(absolute.toString())
    }
  } catch {
    // path-relative — join below
  }

  try {
    const base = new URL(landingPageUrl)
    if (base.protocol !== "http:" && base.protocol !== "https:") return null
    return sanitizeHeatmapPageUrl(new URL(pathOrUrl, base.origin).toString())
  } catch {
    return null
  }
}

export function resolveHeatmapPageUrl(
  requested: string | null | undefined,
  landingPageUrl: string
): string | null {
  const sanitized =
    sanitizeHeatmapPageUrl(requested) ?? sanitizeHeatmapPageUrl(landingPageUrl)
  if (!sanitized) return null
  return joinLandingOrigin(sanitized, landingPageUrl)
}
