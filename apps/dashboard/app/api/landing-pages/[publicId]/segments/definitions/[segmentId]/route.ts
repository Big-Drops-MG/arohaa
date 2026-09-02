import { NextResponse } from "next/server"
import { deleteSegmentDefinition } from "@/lib/server/segment-definitions-store"
import { route } from "@/lib/server/route"

export const DELETE = route(
  {
    permission: "landing_pages.write",
    actor: "write",
    tab: "segments",
    section: "saved",
    rateLimit: "landing",
  },
  async ({ actor, params }) => {
    const result = await deleteSegmentDefinition(
      actor.id,
      params.publicId!,
      params.segmentId!
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
