import { NextResponse } from "next/server"
import { fetchSegmentColumnValues } from "@/lib/server/segment-definitions-store"
import { route } from "@/lib/server/route"

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "segments",
    section: "saved",
    rateLimit: "landing",
  },
  async ({ actor, params, request }) => {
    const column = new URL(request.url).searchParams.get("column")?.trim() ?? ""
    if (!column) {
      return NextResponse.json({ error: "column is required" }, { status: 400 })
    }

    const result = await fetchSegmentColumnValues(
      actor.id,
      params.publicId!,
      column
    )
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    return NextResponse.json(result.data)
  }
)
