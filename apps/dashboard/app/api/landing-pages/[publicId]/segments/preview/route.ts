import { NextResponse } from "next/server"
import { previewSegmentDefinition } from "@/lib/server/segment-definitions-store"
import { route } from "@/lib/server/route"
import { segmentPreviewBodySchema } from "@/lib/server/route-schemas"

export const POST = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "segments",
    section: "saved",
    rateLimit: "landing",
    schema: segmentPreviewBodySchema,
  },
  async ({ actor, params, body }) => {
    const result = await previewSegmentDefinition(
      actor.id,
      params.publicId!,
      body.conditions
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
