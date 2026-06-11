import { NextResponse } from "next/server"
import { loadAlertsDashboardDataForApi } from "@/lib/server/alerts-dashboard-load"

export async function GET(
  request: Request,
  props: { params: Promise<{ publicId: string }> }
) {
  const { searchParams } = new URL(request.url)
  const rangeId = searchParams.get("range_id")
  const { publicId } = await props.params

  const res = await loadAlertsDashboardDataForApi(publicId, rangeId)

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status })
  }

  return NextResponse.json(res.data)
}
