import { NextRequest, NextResponse } from "next/server"
import {
  loadCohortsForApi,
  type CohortSplitBy,
} from "@/lib/server/cohorts-dashboard-load"

function parseSplitBy(raw: string | null): CohortSplitBy | null {
  if (raw === "utm_source" || raw === "utm_campaign") return raw
  return null
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await props.params
  const { searchParams } = new URL(request.url)

  const result = await loadCohortsForApi(publicId, {
    segmentId: searchParams.get("segment_id"),
    splitBy: parseSplitBy(searchParams.get("split_by")),
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.data)
}
