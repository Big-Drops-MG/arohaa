import { NextResponse } from "next/server"
import { loadExperimentsDashboardDataForApi } from "@/lib/server/experiments-dashboard-load"

export async function GET(
  request: Request,
  props: { params: Promise<{ publicId: string }> }
) {
  const { searchParams } = new URL(request.url)
  const rangeId = searchParams.get("range_id")
  const { publicId } = await props.params

  const res = await loadExperimentsDashboardDataForApi(publicId, rangeId)

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status })
  }

  return NextResponse.json(res.data)
}
