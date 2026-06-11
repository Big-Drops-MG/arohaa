import { NextRequest, NextResponse } from "next/server"
import { loadEventTrackingDashboardDataForApi } from "@/lib/server/event-tracking-dashboard-load"

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await props.params

  const { searchParams } = new URL(request.url)
  const rangeIdRaw = searchParams.get("range_id")

  const result = await loadEventTrackingDashboardDataForApi(
    publicId,
    rangeIdRaw
  )

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.data)
}
