import { NextResponse } from "next/server"
import { parseDashboardCustomRange } from "@/features/traffic/model/traffic-range"
import { loadDataExportDashboardDataForApi } from "@/lib/server/data-export-dashboard-load"

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
  const { publicId } = await props.params

  const res = await loadDataExportDashboardDataForApi(
    publicId,
    rangeId,
    customRange,
    searchParams.get("limit"),
    searchParams.get("offset")
  )

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status })
  }

  return NextResponse.json(res.data)
}
