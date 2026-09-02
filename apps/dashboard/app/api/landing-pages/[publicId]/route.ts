import { NextResponse } from "next/server"
import {
  deleteLandingPageForApi,
  getLandingPageForApi,
  patchLandingPageForApi,
} from "@/lib/server/landing-page-id-api"
import { route } from "@/lib/server/route"
import { landingPagePatchBodySchema } from "@/lib/server/route-schemas"

function traceIdFrom(request: Request): string | null {
  return request.headers.get("x-trace-id")?.trim() || null
}

export const GET = route(
  {
    permission: "landing_pages.read",
    actor: "read",
    tab: "settings",
    rateLimit: "landing",
  },
  async ({ actor, params }) => {
    const result = await getLandingPageForApi(actor.id, params.publicId!)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }
    return NextResponse.json({ landingPage: result.data })
  }
)

export const PATCH = route(
  {
    permission: "landing_pages.write",
    actor: "write",
    tab: "settings",
    rateLimit: "landing",
    schema: landingPagePatchBodySchema,
  },
  async ({ actor, params, body, request }) => {
    return patchLandingPageForApi(
      actor,
      params.publicId!,
      body,
      traceIdFrom(request)
    )
  }
)

export const DELETE = route(
  {
    permission: "landing_pages.write",
    actor: "write",
    tab: "settings",
    section: "project",
    rateLimit: "landing",
  },
  async ({ actor, params, request }) => {
    return deleteLandingPageForApi(
      actor,
      params.publicId!,
      traceIdFrom(request)
    )
  }
)
