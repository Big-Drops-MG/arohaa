import { NextResponse } from "next/server"
import {
  createSegmentDefinition,
  listSegmentDefinitions,
} from "@/lib/server/segment-definitions-store"
import { route } from "@/lib/server/route"
import { segmentDefinitionCreateBodySchema } from "@/lib/server/route-schemas"

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "segments",
    section: "saved",
    rateLimit: "landing",
  },
  async ({ actor, params }) => {
    const result = await listSegmentDefinitions(actor.id, params.publicId!)

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    return NextResponse.json(result.data)
  }
)

export const POST = route(
  {
    permission: "landing_pages.write",
    actor: "write",
    tab: "segments",
    section: "saved",
    rateLimit: "landing",
    schema: segmentDefinitionCreateBodySchema,
  },
  async ({ actor, params, body }) => {
    const result = await createSegmentDefinition(actor.id, params.publicId!, {
      name: body.name,
      description: body.description,
      conditions: body.conditions,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    return NextResponse.json(result.data, { status: 201 })
  }
)
