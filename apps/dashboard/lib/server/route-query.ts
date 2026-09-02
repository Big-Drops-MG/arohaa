import "server-only"

import { NextResponse } from "next/server"
import {
  DEFAULT_ROUTE_MAX_OFFSET,
  MAX_DASHBOARD_CUSTOM_SPAN_DAYS,
  parseRouteCustomRange,
  parseRouteOffset,
  sanitizeHeatmapPageUrl,
} from "@/lib/server/route-query-limits"

export {
  DEFAULT_ROUTE_MAX_OFFSET,
  MAX_DASHBOARD_CUSTOM_SPAN_DAYS,
  parseRouteCustomRange,
  parseRouteOffset,
  sanitizeHeatmapPageUrl,
}

export type RouteQueryLimits = {
  maxCustomRangeDays?: number
  maxOffset?: number
}

export function enforceRouteQueryLimits(
  request: Request,
  limits?: RouteQueryLimits
): NextResponse | null {
  if (!limits) return null

  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  if (limits.maxCustomRangeDays != null && from && to) {
    const f = from.trim()
    const t = to.trim()
    if (f && t && !parseRouteCustomRange(f, t, limits.maxCustomRangeDays)) {
      return NextResponse.json(
        {
          error: `Custom date range exceeds ${limits.maxCustomRangeDays} days`,
        },
        { status: 400 }
      )
    }
  }

  if (limits.maxOffset != null && searchParams.has("offset")) {
    const raw = searchParams.get("offset")
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > limits.maxOffset) {
      return NextResponse.json(
        { error: `offset must be between 0 and ${limits.maxOffset}` },
        { status: 400 }
      )
    }
  }

  return null
}
