import { NextResponse } from "next/server"
import {
  loadCohortsForApi,
  type CohortSplitBy,
} from "@/lib/server/cohorts-dashboard-load"
import { route } from "@/lib/server/route"

function parseSplitBy(raw: string | null): CohortSplitBy | null {
  if (raw === "utm_source" || raw === "utm_campaign" || raw === "utm_id") {
    return raw
  }
  return null
}

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "segments",
    section: "cohort",
    rateLimit: "landing",
  },
  async ({ params, request }) => {
    const { searchParams } = new URL(request.url)
    const result = await loadCohortsForApi(params.publicId!, {
      segmentId: searchParams.get("segment_id"),
      splitBy: parseSplitBy(searchParams.get("split_by")),
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    return NextResponse.json(result.data)
  }
)
