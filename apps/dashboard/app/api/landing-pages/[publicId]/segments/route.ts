import { NextRequest, NextResponse } from "next/server"
import { loadSegmentsDashboardDataForApi } from "@/lib/server/segments-dashboard-load"

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await props.params

  const { searchParams } = new URL(request.url)
  const rangeIdRaw = searchParams.get("range_id")

  const result = await loadSegmentsDashboardDataForApi(publicId, rangeIdRaw)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.data)
}
