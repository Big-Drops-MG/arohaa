import { NextResponse } from "next/server"
import type { SeoResultRow } from "@/features/seo/model/seo"
import { parseDashboardCustomRange } from "@/features/traffic/model/traffic-range"
import {
  loadSeoDashboardDataForApi,
  syncSeoRowsForApi,
} from "@/lib/server/seo-dashboard-load"

export async function GET(
  request: Request,
  props: { params: Promise<{ publicId: string }> }
) {
  const { searchParams } = new URL(request.url)
  const rangeId = searchParams.get("range_id")
  const customRange = parseDashboardCustomRange(
    searchParams.get("from"),
    searchParams.get("to")
  )
  const sortBy = searchParams.get("sort_by")
  const sortOrder = searchParams.get("sort_order")
  const { publicId } = await props.params

  const res = await loadSeoDashboardDataForApi(
    publicId,
    rangeId,
    sortBy,
    sortOrder,
    customRange
  )

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status })
  }

  return NextResponse.json(res.data)
}

export async function POST(
  request: Request,
  props: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await props.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const rows =
    typeof body === "object" &&
    body !== null &&
    "rows" in body &&
    Array.isArray((body as { rows: unknown }).rows)
      ? ((body as { rows: SeoResultRow[] }).rows ?? [])
      : null

  if (!rows) {
    return NextResponse.json(
      { error: "rows array is required" },
      { status: 400 }
    )
  }

  const res = await syncSeoRowsForApi(publicId, rows)
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status })
  }

  return NextResponse.json({ inserted: res.inserted })
}
